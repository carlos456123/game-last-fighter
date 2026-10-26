import type { UnlockRule } from '@/types';

/**
 * Single place to tune how each fighter is unlocked. Fighter data files reference this table.
 * Rules are evaluated by ProgressionManager from recorded match results only.
 */
export const UNLOCK_RULES = {
  kael: { type: 'default' },
  bronn: { type: 'default' },
  nyx: { type: 'wins', count: 2 },
  ayame: { type: 'perfectDodges', count: 10 },
  han: { type: 'flawlessWins', count: 5 },
  r0n: { type: 'playerLevel', level: 5 },
  vesper: { type: 'arcadeStreak', count: 3 },
  dante: { type: 'defeatShadow' },
  valkyrie: { type: 'tournamentWin' },
} as const satisfies Record<string, UnlockRule>;
