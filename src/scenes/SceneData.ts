import type { FighterMatchStats } from '@/core/Match';
import type { Reward } from '@/systems/ProgressionManager';

export type BattleMode = 'ladder' | 'training';

/** Everything needed to start a battle. Scenes pass plain data, never live objects. */
export interface BattleData {
  mode: BattleMode;
  p1: string;
  p2: string;
  arena: string;
  shadow: boolean;
  stage: number;
  totalStages: number;
}

export interface ResultData {
  battle: BattleData;
  won: boolean;
  draw: boolean;
  stats: FighterMatchStats;
  durationSeconds: number;
  reward: Reward | null;
}

export interface PauseData {
  mode: BattleMode;
}

export interface SettingsData {
  /** Scene to resume when settings close (e.g. the pause menu). */
  returnTo: string;
  overlay: boolean;
  tab?: number;
}

export interface SelectData {
  browse: boolean;
}
