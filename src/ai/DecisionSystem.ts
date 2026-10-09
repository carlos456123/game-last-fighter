import type { Character } from '@/characters/Character';
import type { CharacterState } from '@/characters/CharacterState';
import type { Projectile } from '@/combat/Projectile';
import type { HitLevel, MoveData, MoveSlot } from '@/types';
import type { Rng } from '@/utils/MathUtils';
import { AIState, type AIStateId } from './AIState';
import type { EffectiveProfile } from './BehaviorProfile';

/** What the AI "sees" of its opponent, possibly from a few frames ago (reaction time). */
export interface OpponentSnapshot {
  x: number;
  y: number;
  vx: number;
  state: CharacterState;
  airborne: boolean;
  attacking: boolean;
  phase: 'startup' | 'active' | 'recovery' | null;
  level: HitLevel | null;
  reach: number;
  vulnerable: boolean;
  invulnerable: boolean;
  knockedDown: boolean;
  healthRatio: number;
}

export interface Perception {
  gap: number;
  dir: 1 | -1;
  opp: OpponentSnapshot;
  selfHealth: number;
  energy: number;
  cornered: boolean;
  incomingProjectile: Projectile | null;
  projectileFrames: number;
}

/** Roles inferred from move data, so the AI works for any fighter without per-character code. */
export interface MoveRoles {
  zoning: MoveData | null;
  antiAir: MoveData | null;
  approach: MoveData | null;
  ultimate: MoveData;
  lightReach: number;
  heavyReach: number;
}

const reachOf = (m: MoveData | undefined): number => (m?.hitbox ? m.hitbox.x + m.hitbox.w : 0);

export const classifyMoves = (fighter: Character): MoveRoles => {
  const specials: MoveSlot[] = ['skill', 'special'];
  const moves = specials.map((s) => fighter.moveForSlot(s));
  const zoning = moves.find((m) => m.projectile) ?? null;
  const antiAir = moves.find((m) => m.invulnerable && (m.movement?.vy ?? 0) > 0) ?? null;
  const approach =
    moves.find((m) => m.teleport) ?? moves.find((m) => m.armor && (m.movement?.vx ?? 0) > 0) ?? null;
  return {
    zoning,
    antiAir,
    approach,
    ultimate: fighter.moveForSlot('ultimate'),
    // Reach expressed as the gap between bodies, the same unit the perception uses.
    lightReach: reachOf(fighter.moveForSlot('light')) - fighter.data.body.width / 2,
    heavyReach: reachOf(fighter.moveForSlot('heavy')) - fighter.data.body.width / 2,
  };
};

export const snapshotOf = (c: Character): OpponentSnapshot => ({
  x: c.x,
  y: c.y,
  vx: c.vx,
  state: c.state,
  airborne: c.airborne,
  attacking: c.move !== null,
  phase: c.movePhase,
  level: c.move?.hit.level ?? null,
  reach: c.move ? reachOf(c.move) || (c.move.projectile ? 9999 : 0) : 0,
  vulnerable: c.isVulnerable,
  invulnerable: c.isInvulnerable(),
  knockedDown: c.state === 'KNOCKDOWN',
  healthRatio: c.health / c.maxHealth,
});

/** Estimated horizontal reach of the ultimate, including movement and teleports. */
export const ultimateReach = (m: MoveData): number => {
  if (m.teleport) return 520;
  const travel = m.movement ? (m.movement.vx * m.active) / 60 : 0;
  return (m.hitbox ? m.hitbox.x + m.hitbox.w : 0) + travel;
};

/**
 * Utility-based strategic choice made while observing. Scores are combined with the
 * profile; accuracy decides between the best option and a weighted random pick.
 */
export const chooseStrategy = (
  p: Perception,
  profile: EffectiveProfile,
  roles: MoveRoles,
  self: Character,
  rng: Rng,
): AIStateId => {
  const d = profile.difficulty;
  const scores: Partial<Record<AIStateId, number>> = {};
  const inLight = p.gap <= roles.lightReach + 10;
  const inHeavy = p.gap <= roles.heavyReach + 10;
  const far = p.gap > profile.preferredRange + 60;

  const ultReady = !self.skills.check(roles.ultimate, false);
  const ultInRange = roles.ultimate.groundedTargetsOnly
    ? !p.opp.airborne && p.gap < 600
    : p.gap <= ultimateReach(roles.ultimate);
  if (ultReady && ultInRange && !p.opp.invulnerable) {
    scores.USE_ULTIMATE = 1.2 + (p.opp.phase === 'recovery' ? 1 : 0) + (p.opp.healthRatio < 0.4 ? 0.6 : 0);
  }

  if (p.opp.knockedDown) scores.CHASE = 0.6 + profile.aggression;
  if (!inLight) {
    scores.APPROACH = (far ? 0.5 : 0.25) + profile.aggression * (far ? 0.8 : 0.6) + profile.mobility * 0.3;
  }
  if (inHeavy) scores.ATTACK = (inLight ? 0.4 : 0.15) + profile.aggression * 1.1 + profile.combo * 0.4;
  if (p.opp.phase === 'recovery' && p.gap < roles.heavyReach + 30) {
    scores.ATTACK = (scores.ATTACK ?? 0) + d.punishChance * 1.5;
  }

  const zoning = roles.zoning && !self.skills.check(roles.zoning, false);
  if (zoning && p.gap > 260) scores.USE_SKILL = 0.3 + profile.skill * 1.1;
  const approachMove = roles.approach && !self.skills.check(roles.approach, false);
  if (approachMove && p.gap > 120 && p.gap < 420) {
    scores.USE_SKILL = Math.max(scores.USE_SKILL ?? 0, 0.2 + profile.skill * 0.8);
  }

  if (p.selfHealth < 0.35 || (p.gap < 80 && profile.retreat > 0.3)) {
    scores.RETREAT = profile.retreat * 1.2 + (p.selfHealth < 0.35 ? 0.4 : 0) - (p.cornered ? 1 : 0);
  }
  if (p.opp.attacking && p.opp.phase !== 'recovery' && p.gap < 200) {
    scores.DEFEND = profile.defense * 0.8 + d.blockChance;
  }
  scores.OBSERVE = 0.25;

  const entries = Object.entries(scores) as Array<[AIStateId, number]>;
  const positive = entries.filter(([, s]) => s > 0);
  if (positive.length === 0) return AIState.OBSERVE;
  if (rng.chance(d.accuracy)) {
    return positive.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  }
  const total = positive.reduce((acc, [, s]) => acc + s, 0);
  let roll = rng.next() * total;
  for (const [id, s] of positive) {
    roll -= s;
    if (roll <= 0) return id;
  }
  return positive[positive.length - 1][0];
};
