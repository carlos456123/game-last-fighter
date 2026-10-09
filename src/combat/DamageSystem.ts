import { COMBAT } from '@/config/gameConfig';
import { clamp } from '@/utils/MathUtils';

/** Pure damage maths. Kept free of state so balancing can be unit-tested. */

/** Damage multiplier for the n-th hit (1-based) of a combo. */
export const comboDamageScale = (hitIndex: number): number => {
  if (hitIndex <= 2) return 1;
  return Math.max(COMBAT.comboMinScale, Math.pow(COMBAT.comboDamageScale, hitIndex - 2));
};

/** Hitstun multiplier for the n-th hit (1-based) of a combo. */
export const comboHitstunScale = (hitIndex: number): number =>
  Math.max(COMBAT.comboMinHitstunScale, 1 - COMBAT.comboHitstunDecay * Math.max(0, hitIndex - 1));

export interface DamageInput {
  base: number;
  strength: number;
  defense: number;
  comboIndex: number;
  /** Extra multiplier (armor absorption, etc.). */
  modifier?: number;
}

export const computeDamage = ({ base, strength, defense, comboIndex, modifier = 1 }: DamageInput): number => {
  if (base <= 0) return 0;
  const raw = (base * strength * comboDamageScale(comboIndex) * modifier) / Math.max(0.1, defense);
  return Math.max(1, Math.round(raw));
};

export const computeChip = (damage: number, chip: number): number =>
  chip <= 0 ? 0 : Math.max(1, Math.round(damage * clamp(chip, 0, 1)));

/** Chip damage can never finish a round. */
export const applyChip = (health: number, chip: number): number => Math.max(1, health - chip);

export const energyFromDamageTaken = (damage: number): number => damage * COMBAT.energyPerDamageTaken;
