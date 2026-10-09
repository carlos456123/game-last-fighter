import { expect, test } from '@playwright/test';
import { battle, boot, clickTarget, startLadder, waitForPhase } from './helpers';

test.describe('LAST FIGHTER — mobile', () => {
  test('touch controls appear in landscape and drive the fighter', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await startLadder(page, true);
    await waitForPhase(page, 'fight');
    await page.evaluate(() => window.__LF__!.setAIEnabled(false));
    const ids = (await page.evaluate(() => window.__LF__!.targets())).map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(['touch-light', 'touch-heavy', 'touch-block', 'touch-ultimate']),
    );
    await clickTarget(page, 'touch-light', true);
    await expect.poll(async () => (await battle(page))!.p1.state, { timeout: 5_000 }).toBe('ATTACK');
  });

  test('portrait orientation asks to rotate the device', async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await expect(page.locator('#rotate-overlay')).toBeVisible();
    await expect(page.locator('#rotate-overlay h1')).toHaveText('GIRE O DISPOSITIVO');
  });
});
