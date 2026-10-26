import type { FighterMatchStats } from '@/core/Match';
import type { Reward } from '@/systems/ProgressionManager';

export type BattleMode = 'ladder' | 'training' | 'tournament';

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
  /** Tournament outcome of this match (only in tournament mode). */
  tournament: { champion: boolean; eliminated: boolean } | null;
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

export type SelectMode = 'arcade' | 'tournament' | 'browse';

export interface SelectData {
  mode: SelectMode;
}

/** One line of a short story scene. `speaker` is a fighter id, 'council' or 'narrator'. */
export interface DialogLine {
  speaker: string;
  textKey: string;
  params?: Record<string, string | number>;
}

export interface DialogData {
  lines: DialogLine[];
  /** Scene to start when the dialog ends or is skipped. */
  next: string;
  nextData?: object;
  /** Optional title shown above the dialog box (e.g. "QUARTAS DE FINAL"). */
  titleKey?: string;
}
