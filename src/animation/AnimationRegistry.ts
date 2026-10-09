import { COMBAT } from '@/config/gameConfig';
import type { Character } from '@/characters/Character';
import { ANIMATIONS } from './PoseLibrary';

export interface AnimationSample {
  name: string;
  t: number;
}

/** Loop lengths in frames for cyclic animations. */
const PERIOD = { idle: 64, walk: 42, run: 26, crouch: 70, stun: 48, flurry: 8 } as const;

/** Startup/active/recovery map to fixed portions of every move animation. */
export const movePhaseTime = (c: Character): number => {
  const m = c.move;
  if (!m) return 0;
  const f = c.moveFrame;
  if (f < m.startup) return (f / Math.max(1, m.startup)) * 0.4;
  if (f < m.startup + m.active) return 0.4 + ((f - m.startup) / Math.max(1, m.active)) * 0.2;
  return 0.6 + ((f - m.startup - m.active) / Math.max(1, m.recovery)) * 0.4;
};

/**
 * Picks the animation and its normalised time for the fighter's current state. Pure function of
 * the simulation, so the same state always renders the same pose.
 */
export const selectAnimation = (c: Character, clock: number): AnimationSample => {
  const f = c.stateFrame;
  switch (c.state) {
    case 'IDLE':
      return { name: 'idle', t: clock / PERIOD.idle };
    case 'WALK': {
      const backwards = c.vx * c.facing < 0;
      const t = clock / PERIOD.walk;
      return { name: 'walk', t: backwards ? -t : t };
    }
    case 'RUN':
      return { name: 'run', t: clock / PERIOD.run };
    case 'JUMP':
      if (c.y === 0) return { name: 'prejump', t: 0 };
      return { name: 'jump', t: Math.min(1, f / 14) };
    case 'FALL':
      return { name: 'fall', t: Math.min(1, f / 18) };
    case 'CROUCH':
      return { name: 'crouch', t: clock / PERIOD.crouch };
    case 'BLOCK':
      return { name: c.crouchBlocking ? 'crouch_block' : 'block', t: 0 };
    case 'DODGE':
      return { name: 'dodge', t: f / c.data.dodge.duration };
    case 'HIT':
      if (c.launched || c.airborne) return { name: 'hit_air', t: Math.min(1, f / 20) };
      return { name: 'hit', t: Math.min(1, f / 14) };
    case 'STUN':
      return { name: 'stun', t: clock / PERIOD.stun };
    case 'KNOCKDOWN': {
      const remaining = c.knockdownTimer;
      if (remaining < 14) return { name: 'wakeup', t: 1 - remaining / 14 };
      return { name: 'knockdown', t: Math.min(1, f / (COMBAT.knockdownFrames * 0.4)) };
    }
    case 'ATTACK':
    case 'SPECIAL':
    case 'ULTIMATE': {
      if (c.lockActive) return { name: 'flurry', t: clock / PERIOD.flurry };
      const name = c.move?.animation ?? 'idle';
      return { name: ANIMATIONS[name] ? name : 'jab', t: movePhaseTime(c) };
    }
    case 'VICTORY':
      return { name: `victory_${c.data.body.victory}`, t: Math.min(1, f / 40) };
    case 'DEFEAT':
      if (c.health > 0 && !c.launched) return { name: 'defeat_kneel', t: Math.min(1, f / 30) };
      return { name: 'knockdown', t: 1 };
    default:
      return { name: 'idle', t: 0 };
  }
};
