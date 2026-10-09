import { describe, expect, it } from 'vitest';
import { CharacterState as S, canTransition } from '@/characters/CharacterState';

describe('CharacterState transitions', () => {
  it('allows normal flow', () => {
    expect(canTransition(S.IDLE, S.WALK)).toBe(true);
    expect(canTransition(S.IDLE, S.ATTACK)).toBe(true);
    expect(canTransition(S.ATTACK, S.ATTACK)).toBe(true); // chains
    expect(canTransition(S.JUMP, S.FALL)).toBe(true);
    expect(canTransition(S.HIT, S.STUN)).toBe(true);
  });

  it('rejects impossible transitions', () => {
    expect(canTransition(S.HIT, S.ATTACK)).toBe(false);
    expect(canTransition(S.STUN, S.ATTACK)).toBe(false);
    expect(canTransition(S.KNOCKDOWN, S.ATTACK)).toBe(false);
    expect(canTransition(S.KNOCKDOWN, S.HIT)).toBe(false);
    expect(canTransition(S.DEFEAT, S.IDLE)).toBe(false);
    expect(canTransition(S.VICTORY, S.ATTACK)).toBe(false);
    expect(canTransition(S.ULTIMATE, S.SPECIAL)).toBe(false);
    expect(canTransition(S.DODGE, S.ATTACK)).toBe(false);
  });

  it('round end can interrupt but defeat is final', () => {
    expect(canTransition(S.ATTACK, S.VICTORY)).toBe(true);
    expect(canTransition(S.HIT, S.DEFEAT)).toBe(true);
    expect(canTransition(S.DEFEAT, S.VICTORY)).toBe(false);
    expect(canTransition(S.VICTORY, S.DEFEAT)).toBe(false);
  });
});
