import type { BehaviorProfile, Difficulty } from '@/types';

/**
 * Difficulty never changes damage. It changes how fast and how well the AI perceives and decides.
 */
export interface DifficultyProfile {
  /** Frames of delay before the AI perceives what the player is doing. */
  reactionFrames: number;
  /** Frames between strategic decisions while observing. */
  decisionInterval: number;
  /** Probability of picking the best scored option instead of a weighted random one. */
  accuracy: number;
  aggressionMul: number;
  skillMul: number;
  blockChance: number;
  dodgeChance: number;
  antiAirChance: number;
  /** Chance to stop a combo early (simulates execution errors). */
  comboDrop: number;
  /** Chance to punish a whiffed attack. */
  punishChance: number;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    reactionFrames: 26,
    decisionInterval: 32,
    accuracy: 0.4,
    aggressionMul: 0.7,
    skillMul: 0.5,
    blockChance: 0.25,
    dodgeChance: 0.1,
    antiAirChance: 0.15,
    comboDrop: 0.5,
    punishChance: 0.2,
  },
  normal: {
    reactionFrames: 16,
    decisionInterval: 18,
    accuracy: 0.68,
    aggressionMul: 1,
    skillMul: 1,
    blockChance: 0.55,
    dodgeChance: 0.3,
    antiAirChance: 0.45,
    comboDrop: 0.22,
    punishChance: 0.5,
  },
  hard: {
    reactionFrames: 10,
    decisionInterval: 10,
    accuracy: 0.88,
    aggressionMul: 1.15,
    skillMul: 1.2,
    blockChance: 0.8,
    dodgeChance: 0.5,
    antiAirChance: 0.75,
    comboDrop: 0.08,
    punishChance: 0.8,
  },
};

/** Normalised 0..1 view of a fighter profile combined with the difficulty. */
export interface EffectiveProfile {
  aggression: number;
  defense: number;
  mobility: number;
  combo: number;
  skill: number;
  dodge: number;
  retreat: number;
  preferredRange: number;
  difficulty: DifficultyProfile;
}

export const combineProfile = (profile: BehaviorProfile, difficulty: Difficulty): EffectiveProfile => {
  const d = DIFFICULTY_PROFILES[difficulty];
  const n = (v: number): number => Math.max(0, Math.min(1, v / 100));
  return {
    aggression: n(profile.aggression) * d.aggressionMul,
    defense: n(profile.defense),
    mobility: n(profile.mobility),
    combo: n(profile.comboPreference),
    skill: n(profile.skillUsage) * d.skillMul,
    dodge: n(profile.dodgePreference),
    retreat: n(profile.retreatPreference),
    preferredRange: profile.preferredRange,
    difficulty: d,
  };
};
