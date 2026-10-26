import type { SaveData } from '@/systems/SaveManager';
import { FIGHTERS } from '@/data/characters';
import { MASTERY, masteryLevel } from './specializations';

/**
 * Achievement catalog. Progress is always derived from recorded save data (never from UI input),
 * so achievements cannot be granted twice or by reloading. Rewards are XP and titles.
 */
export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  target: number;
  progress: (save: SaveData) => number;
  xp: number;
  /** Title unlocked with the achievement (shown in the menu and on the HUD). */
  title?: string;
}

/** Combo length that counts as "Mestre dos Combos": reachable with a light chain into a special and an ultimate. */
export const COMBO_MASTER_HITS = 8;

const def = (
  id: string,
  target: number,
  xp: number,
  progress: (s: SaveData) => number,
  title?: string,
): AchievementDef => ({
  id,
  nameKey: `achievements.${id}.name`,
  descKey: `achievements.${id}.desc`,
  target,
  xp,
  progress,
  title,
});

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  def('first_win', 1, 100, (s) => s.progress.wins),
  def('win_streak', 3, 150, (s) => s.progress.bestArcadeStreak),
  def('perfect_dodge', 10, 150, (s) => s.progress.perfectDodges, 'titles.untouchable'),
  def('combo_master', COMBO_MASTER_HITS, 200, (s) => s.stats.bestCombo, 'titles.combo_artist'),
  def('flawless', 5, 200, (s) => s.progress.flawlessWins, 'titles.flawless'),
  def('shadow_hunter', 1, 250, (s) => s.progress.shadowWins, 'titles.shadow_hunter'),
  def('arena_champion', 1, 400, (s) => s.progress.tournamentsWon, 'titles.champion'),
  def(
    'absolute_mastery',
    1,
    300,
    (s) => (Object.values(s.progress.mastery).some((m) => masteryLevel(m.xp) >= MASTERY.maxLevel) ? 1 : 0),
    'titles.master',
  ),
  def('collector', FIGHTERS.length, 300, (s) => s.progress.unlockedFighters.length, 'titles.collector'),
  def('versatile', 3, 150, (s) => s.progress.winningFighters.length),
  def('guardian', 50, 100, (s) => s.stats.blocks),
  def('arsenal', 25, 100, (s) => s.stats.skillsUsed + s.stats.ultimatesUsed),
  def('traveler', 4, 150, (s) => s.progress.winningArenas.length),
];

export const getAchievement = (id: string): AchievementDef | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);
