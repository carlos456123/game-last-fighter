import type Phaser from 'phaser';
import { getFighter } from '@/characters/CharacterFactory';
import type { Reward } from '@/systems/ProgressionManager';
import type { LocalizationManager } from '@/systems/LocalizationManager';
import type { AudioManager } from '@/systems/AudioManager';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { showToast } from './Toast';

/**
 * Post-battle reward list (XP lines, level up, mastery, unlocks, achievements) plus short,
 * sequential notifications. Shown on result screens only, never during combat.
 */
export const showRewards = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  reward: Reward,
  i18n: LocalizationManager,
  audio: AudioManager,
): void => {
  const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
  scene.add.text(
    x,
    y,
    t('victory.rewards'),
    textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
  );
  let ry = y + 34;
  const lines = reward.bonuses.slice(0, 8);
  lines.forEach((b, i) => {
    const line = scene.add
      .text(x, ry + i * 26, `${t(b.key)}  +${b.xp}`, textStyle({ size: TYPE.small }))
      .setAlpha(0);
    scene.tweens.add({ targets: line, alpha: 1, x: x + 6, delay: 250 + i * 110, duration: 200 });
  });
  ry += lines.length * 26 + 8;
  scene.add.text(
    x,
    ry,
    t('victory.xpGained', { xp: reward.xp }),
    textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.gold }),
  );
  ry += 44;
  const extra: Array<{ text: string; color: string }> = [];
  if (reward.levelAfter > reward.levelBefore)
    extra.push({ text: t('victory.levelUp', { level: reward.levelAfter }), color: TEXT_COLORS.success });
  if (reward.mastery.levelAfter > reward.mastery.levelBefore) {
    extra.push({
      text: t('victory.masteryUp', {
        fighter: t(getFighter(reward.mastery.fighterId).nameKey),
        level: t(`mastery.level${reward.mastery.levelAfter}`),
      }),
      color: TEXT_COLORS.cyan,
    });
  }
  for (const line of extra) {
    scene.add.text(
      x,
      ry,
      line.text,
      textStyle({ font: 'display', size: TYPE.tiny, color: line.color, wrap: 380 }),
    );
    ry += 28;
  }
  // Sequential toasts for the big moments (one at a time, never stacked on top of each other).
  const toasts: Array<{ text: string; color: number; sfx: 'unlock' | 'achievement' }> = [
    ...reward.unlocked.map((id) => ({
      text: `🔓 ${t('victory.unlocked', { name: t(getFighter(id).nameKey) })}`,
      color: COLORS.accent,
      sfx: 'unlock' as const,
    })),
    ...reward.achievements.map((id) => ({
      text: `★ ${t('victory.achievement', { name: t(`achievements.${id}.name`) })}`,
      color: COLORS.gold,
      sfx: 'achievement' as const,
    })),
  ];
  toasts.forEach((toast, i) => {
    scene.time.delayedCall(900 + i * 2400, () => {
      audio.play(toast.sfx);
      showToast(scene, toast.text, toast.color, 2200);
    });
  });
};
