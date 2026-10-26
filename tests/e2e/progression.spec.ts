import { expect, test, type Page } from '@playwright/test';
import {
  battle,
  boot,
  clickTarget,
  save,
  skipDialog,
  startLadder,
  targets,
  waitForPhase,
  waitForScene,
  winMatch,
} from './helpers';

const SAVE_KEY = 'last-fighter-save';

/** Plays one tournament match from the bracket screen to the result screen. */
const playTournamentMatch = async (page: Page): Promise<void> => {
  await clickTarget(page, 'tournament-fight');
  await skipDialog(page);
  await waitForScene(page, 'BattleScene');
  await expect.poll(async () => (await battle(page))?.mode).toBe('tournament');
  await winMatch(page);
  await waitForScene(page, 'VictoryScene', 60_000);
};

test.describe('LAST FIGHTER — progression', () => {
  test('a win grants XP, mastery and the first achievement, and survives a reload', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await startLadder(page);
    await winMatch(page);
    await waitForScene(page, 'VictoryScene', 60_000);
    const data = await save(page);
    expect(data.progress.xp).toBeGreaterThan(0);
    expect(data.progress.arcadeWins).toBe(1);
    expect(data.progress.mastery.kael.xp).toBeGreaterThan(0);
    expect(Object.keys(data.progress.achievements)).toContain('first_win');
    expect(data.progress.claimedMatches).toHaveLength(1);

    await boot(page, false);
    const after = await save(page);
    expect(after.progress.xp).toBe(data.progress.xp);
    expect(after.progress.achievements.first_win).toBe(data.progress.achievements.first_win);
    expect(errors).toEqual([]);
  });

  test('training mode never grants XP', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await clickTarget(page, 'menu-tutorial');
    await clickTarget(page, 'tutorial-practice');
    await waitForPhase(page, 'fight');
    await page.keyboard.press('KeyJ');
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await clickTarget(page, 'pause-quit');
    await clickTarget(page, 'pause-quit-yes');
    await waitForScene(page, 'MenuScene');
    const data = await save(page);
    expect(data.progress.xp).toBe(0);
    expect(data.progress.claimedMatches).toHaveLength(0);
  });

  test('a chosen specialization changes the fighter in Arcade', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await startLadder(page);
    await waitForPhase(page, 'fight');
    const base = (await page.evaluate(() => window.__LF__!.move('p1', 'kael_ember')))!;

    // Seed Mastery III with a specialization, as if earned by playing.
    await page.evaluate((key) => {
      const data = window.__LF__!.save();
      data.progress.mastery.kael = { xp: 900, spec: 'kael_ember' };
      data.progress.ladder = null;
      localStorage.setItem(key, JSON.stringify(data));
    }, SAVE_KEY);
    await boot(page, false);
    expect((await save(page)).progress.mastery.kael.spec).toBe('kael_ember');
    await startLadder(page);
    await waitForPhase(page, 'fight');
    const spec = (await page.evaluate(() => window.__LF__!.move('p1', 'kael_ember')))!;
    expect(spec.cooldown).toBeLessThan(base.cooldown);
    expect(spec.energyCost).toBeLessThan(base.energyCost);
    expect(spec.damage).toBe(base.damage);
  });

  test('tournament: quarter → semi → final, persistent bracket, Valquíria only after the title', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    expect((await save(page)).progress.unlockedFighters).not.toContain('valkyrie');

    await clickTarget(page, 'menu-tournament');
    await waitForScene(page, 'TournamentScene');
    await clickTarget(page, 'tournament-new');
    await skipDialog(page); // the opening story only plays on the first edition
    await waitForScene(page, 'CharacterSelectScene');
    await clickTarget(page, 'select-fight');
    await waitForScene(page, 'TournamentScene');
    let t = (await save(page)).tournament!;
    expect(t.status).toBe('active');
    expect(t.participants).toHaveLength(8);
    // Valquíria may enter as the reigning champion, but is not playable until the title.

    // Quarter final, then reload in the middle of the tournament.
    await playTournamentMatch(page);
    expect((await save(page)).tournament!.round).toBe(1);
    expect((await save(page)).progress.unlockedFighters).not.toContain('valkyrie');
    await boot(page, false);
    await clickTarget(page, 'menu-tournament');
    await waitForScene(page, 'TournamentScene');
    expect((await targets(page)).map((x) => x.id)).toContain('tournament-fight');
    t = (await save(page)).tournament!;
    expect(t.round).toBe(1);
    expect(t.status).toBe('active');

    // Semi final.
    await playTournamentMatch(page);
    expect((await save(page)).tournament!.round).toBe(2);
    await clickTarget(page, 'victory-next');
    await waitForScene(page, 'TournamentScene');

    // Final.
    await playTournamentMatch(page);
    const data = await save(page);
    expect(data.tournament!.status).toBe('champion');
    expect(data.progress.tournamentsWon).toBe(1);
    expect(data.progress.unlockedFighters).toContain('valkyrie');
    expect(Object.keys(data.progress.achievements)).toContain('arena_champion');

    // Epilogue, then back to the tournament hub with a new edition available.
    await clickTarget(page, 'victory-next');
    await skipDialog(page);
    await waitForScene(page, 'TournamentScene');
    expect((await targets(page)).map((x) => x.id)).toContain('tournament-new');
    expect(errors).toEqual([]);
  });
});
