import { computeRatings } from '@/characters/CharacterStats';
import { getFighter } from '@/characters/CharacterFactory';

/** Unique id per battle instance; used to reward each match at most once. */
export const createMatchId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Strength used to simulate AI-vs-AI tournament matches: the sum of the fighter's ratings. */
export const tournamentStrength = (fighterId: string): number =>
  Object.values(computeRatings(getFighter(fighterId))).reduce((a, b) => a + b, 0);
