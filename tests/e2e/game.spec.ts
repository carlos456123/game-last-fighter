import { expect, test } from '@playwright/test';
import {
  activeScenes,
  battle,
  boot,
  clickTarget,
  closeDistance,
  save,
  startLadder,
  waitForPhase,
  waitForScene,
} from './helpers';

test.describe('LAST FIGHTER — desktop flow', () => {
  test('menu → select → battle → move, attack, take damage, pause, resume, win', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await startLadder(page);
    await waitForPhase(page, 'fight');

    // Move
    const x0 = (await battle(page))!.p1.x;
    await page.keyboard.down('KeyD');
    await expect.poll(async () => (await battle(page))!.p1.x, { timeout: 10_000 }).toBeGreaterThan(x0 + 20);
    await page.keyboard.up('KeyD');

    // Attack
    await page.keyboard.press('KeyJ');
    await expect.poll(async () => (await battle(page))!.p1.state, { timeout: 5_000 }).toBe('ATTACK');

    // Receive damage from the AI
    await expect
      .poll(
        async () => {
          const b = (await battle(page))!;
          return b.p1.health < b.p1.maxHealth;
        },
        { timeout: 90_000 },
      )
      .toBe(true);

    // Pause really stops the simulation
    await page.keyboard.press('Escape');
    await waitForScene(page, 'PauseScene');
    const frozen = (await battle(page))!.frame;
    await page.waitForTimeout(800);
    expect((await battle(page))!.frame).toBe(frozen);
    expect((await battle(page))!.paused).toBe(true);

    // Resume
    await clickTarget(page, 'pause-resume');
    await expect.poll(async () => (await battle(page))!.frame, { timeout: 10_000 }).toBeGreaterThan(frozen);

    // Finish the battle with real hits (the hook only lowers HP so the test is fast)
    await page.evaluate(() => window.__LF__!.setAIEnabled(false));
    for (let round = 0; round < 2; round++) {
      await waitForPhase(page, 'fight', 60_000);
      await page.evaluate(() => window.__LF__!.setAIEnabled(false));
      await closeDistance(page);
      await page.evaluate(() => window.__LF__!.setHealth('p2', 1));
      await expect
        .poll(
          async () => {
            await page.keyboard.press('KeyJ');
            return (await battle(page))?.phase;
          },
          { timeout: 20_000 },
        )
        .not.toBe('fight');
    }
    await waitForScene(page, 'VictoryScene', 60_000);
    const data = await save(page);
    expect(data.progress.wins).toBe(1);
    expect(data.progress.ladder?.stage).toBe(1);

    // Reload keeps progress and offers to continue the ladder
    await boot(page, false);
    expect((await save(page)).progress.wins).toBe(1);
    await expect
      .poll(async () => (await page.evaluate(() => window.__LF__!.targets())).map((t) => t.id))
      .toContain('menu-continue');
    expect(errors).toEqual([]);
  });

  test('settings persist across reloads', async ({ page }) => {
    await boot(page);
    await clickTarget(page, 'menu-settings');
    await waitForScene(page, 'SettingsScene');
    const before = (await save(page)).settings.musicVolume;
    await page.keyboard.press('ArrowDown'); // focus the music slider
    await page.keyboard.press('ArrowLeft'); // -10%
    await expect.poll(async () => (await save(page)).settings.musicVolume).toBeCloseTo(before - 0.1, 5);
    await clickTarget(page, 'settings-tab-video');
    await clickTarget(page, 'set-shake');
    await expect.poll(async () => (await save(page)).settings.screenShake).toBe(false);
    await boot(page, false);
    const s = (await save(page)).settings;
    expect(s.musicVolume).toBeCloseTo(before - 0.1, 5);
    expect(s.screenShake).toBe(false);
  });

  test('remapped controls are used in battle', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await clickTarget(page, 'menu-settings');
    await waitForScene(page, 'SettingsScene');
    await clickTarget(page, 'settings-tab-controls');
    await clickTarget(page, 'set-key-light');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyO');
    await expect.poll(async () => (await save(page)).controls.light[0]).toBe('KeyO');
    await clickTarget(page, 'settings-back');
    await waitForScene(page, 'MenuScene');
    await startLadder(page);
    await waitForPhase(page, 'fight');
    await page.evaluate(() => window.__LF__!.setAIEnabled(false));
    await page.keyboard.press('KeyO');
    await expect.poll(async () => (await battle(page))!.p1.state, { timeout: 5_000 }).toBe('ATTACK');
  });

  test('tutorial practice mode tracks tasks', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await clickTarget(page, 'menu-tutorial');
    await waitForScene(page, 'TutorialScene');
    await clickTarget(page, 'tutorial-practice');
    await waitForScene(page, 'BattleScene');
    await expect.poll(async () => (await battle(page))?.mode).toBe('training');
    await page.keyboard.press('KeyW');
    await expect.poll(async () => (await battle(page))!.p1.state, { timeout: 5_000 }).toMatch(/JUMP|FALL/);
    expect(await activeScenes(page)).toContain('BattleScene');
  });
});
