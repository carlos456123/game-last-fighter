import type Phaser from 'phaser';
import type { FighterMatchStats } from '@/core/Match';
import type { LocalizationManager } from '@/systems/LocalizationManager';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';

/** Post-battle statistics block shared by the victory and defeat screens. */
export const createStatsPanel = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  stats: FighterMatchStats,
  seconds: number,
  i18n: LocalizationManager,
): Phaser.GameObjects.Container => {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, 0.9);
  g.fillRoundedRect(0, 0, 420, 230, 10);
  g.lineStyle(2, COLORS.line, 1);
  g.strokeRoundedRect(0, 0, 420, 230, 10);
  c.add(g);
  c.add(
    scene.add.text(
      20,
      16,
      i18n.t('stats.title'),
      textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
    ),
  );
  const rows: Array<[string, string]> = [
    [i18n.t('stats.damageDealt'), String(stats.damageDealt)],
    [i18n.t('stats.damageTaken'), String(stats.damageTaken)],
    [i18n.t('stats.maxCombo'), String(stats.maxCombo)],
    [i18n.t('stats.skillsUsed'), String(stats.skillsUsed + stats.ultimatesUsed)],
    [i18n.t('stats.time'), `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`],
  ];
  rows.forEach(([label, value], i) => {
    c.add(scene.add.text(20, 56 + i * 34, label, textStyle({ size: TYPE.small, color: TEXT_COLORS.dim })));
    c.add(
      scene.add
        .text(400, 56 + i * 34, value, textStyle({ font: 'display', size: TYPE.small }))
        .setOrigin(1, 0),
    );
  });
  return c;
};
