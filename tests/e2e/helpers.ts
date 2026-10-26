import { expect, type Page } from '@playwright/test';

/** Helpers that drive the real game through the canvas, using the e2e hook only to observe state. */
export const boot = async (page: Page, clearSave = true): Promise<void> => {
  await page.goto('/');
  if (clearSave) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await waitForScene(page, 'MenuScene');
};

export const activeScenes = (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__LF__?.activeScenes() ?? []);

export const waitForScene = async (page: Page, scene: string, timeout = 30_000): Promise<void> => {
  await expect.poll(() => activeScenes(page), { timeout }).toContain(scene);
};

/** Clicks a registered UI element (button, card, touch control) at its real canvas position. */
export const clickTarget = async (page: Page, id: string, touch = false): Promise<void> => {
  // Wait until the element exists and has stopped animating (menus slide in).
  let last = '';
  await expect
    .poll(
      async () => {
        const t = (await targets(page)).find((x) => x.id === id);
        const key = t ? `${Math.round(t.x)},${Math.round(t.y)}` : '';
        const stable = key !== '' && key === last;
        last = key;
        return stable;
      },
      { timeout: 15_000, intervals: [200] },
    )
    .toBe(true);
  await page.waitForTimeout(150);
  const target = (await targets(page)).find((t) => t.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + (target.x / 1280) * box.width;
  const y = box.y + (target.y / 720) * box.height;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
};

export const targets = (page: Page) => page.evaluate(() => window.__LF__?.targets() ?? []);

export const battle = (page: Page) => page.evaluate(() => window.__LF__?.battle() ?? null);

export const waitForPhase = async (page: Page, phase: string, timeout = 40_000): Promise<void> => {
  await expect.poll(async () => (await battle(page))?.phase, { timeout }).toBe(phase);
};

export const save = (page: Page) => page.evaluate(() => window.__LF__!.save());

/** Starts the arcade ladder with the first fighter, the way a player would. */
export const startLadder = async (page: Page, touch = false): Promise<void> => {
  await clickTarget(page, 'menu-play', touch);
  await waitForScene(page, 'CharacterSelectScene');
  await clickTarget(page, 'select-fight', touch);
  await waitForScene(page, 'BattleScene');
};

/** Walks the player towards the opponent until they are in jab range. */
export const closeDistance = async (page: Page): Promise<void> => {
  await page.keyboard.down('KeyD');
  await expect
    .poll(
      async () => {
        const b = await battle(page);
        return b ? b.p2.x - b.p1.x : 9999;
      },
      { timeout: 20_000 },
    )
    .toBeLessThan(115);
  await page.keyboard.up('KeyD');
};

/**
 * Wins the current best-of-3 with real jabs. The AI is paused and the hook only lowers the
 * opponent's HP so each round ends on the next connected hit.
 */
export const winMatch = async (page: Page): Promise<void> => {
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
};

/** Skips a story scene if one is showing. */
export const skipDialog = async (page: Page): Promise<void> => {
  await waitForScene(page, 'DialogScene');
  await clickTarget(page, 'dialog-skip');
};
