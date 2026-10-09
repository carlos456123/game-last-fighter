import { describe, expect, it } from 'vitest';
import {
  applyChip,
  comboDamageScale,
  comboHitstunScale,
  computeChip,
  computeDamage,
} from '@/combat/DamageSystem';
import { COMBAT } from '@/config/gameConfig';

describe('DamageSystem', () => {
  it('applies strength and defense', () => {
    expect(computeDamage({ base: 10, strength: 1, defense: 1, comboIndex: 1 })).toBe(10);
    expect(computeDamage({ base: 10, strength: 1.2, defense: 1, comboIndex: 1 })).toBe(12);
    expect(computeDamage({ base: 10, strength: 1, defense: 1.25, comboIndex: 1 })).toBe(8);
  });

  it('never deals less than 1 for a real attack and 0 for none', () => {
    expect(computeDamage({ base: 1, strength: 0.5, defense: 2, comboIndex: 30 })).toBe(1);
    expect(computeDamage({ base: 0, strength: 1, defense: 1, comboIndex: 1 })).toBe(0);
  });

  it('scales combo damage down progressively with a floor', () => {
    expect(comboDamageScale(1)).toBe(1);
    expect(comboDamageScale(2)).toBe(1);
    expect(comboDamageScale(3)).toBeLessThan(1);
    expect(comboDamageScale(4)).toBeLessThan(comboDamageScale(3));
    expect(comboDamageScale(100)).toBe(COMBAT.comboMinScale);
  });

  it('reduces hitstun as combos grow so they end naturally', () => {
    expect(comboHitstunScale(1)).toBe(1);
    expect(comboHitstunScale(5)).toBeLessThan(comboHitstunScale(2));
    expect(comboHitstunScale(100)).toBe(COMBAT.comboMinHitstunScale);
  });

  it('chip damage cannot KO', () => {
    expect(computeChip(10, 0.25)).toBe(3);
    expect(computeChip(10, 0)).toBe(0);
    expect(applyChip(2, 5)).toBe(1);
  });
});
