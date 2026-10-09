import { FPS } from '@/config/gameConfig';
import type { FighterData, MoveData, Ratings } from '@/types';
import { clamp } from '@/utils/MathUtils';

/**
 * Derived, measurable numbers about a fighter. UI ratings are computed from the actual data so
 * the character select screen can never disagree with the gameplay.
 */

const totalFrames = (m: MoveData): number => m.startup + m.active + m.recovery;

/** Damage of the full light chain (no scaling), multiplied by strength. */
export const lightChainDamage = (data: FighterData): number => {
  let total = 0;
  let id: string | undefined = data.slots.light;
  const guard = new Set<string>();
  while (id && !guard.has(id)) {
    guard.add(id);
    const m = data.moves.find((x) => x.id === id);
    if (!m) break;
    total += m.hit.damage * m.hits;
    id = m.chain;
  }
  return total * data.stats.strength;
};

export const lightChainLength = (data: FighterData): number => {
  let count = 0;
  let id: string | undefined = data.slots.light;
  while (id && count < 20) {
    count++;
    id = data.moves.find((x) => x.id === id)?.chain;
  }
  return count;
};

/** Average damage per second of the fighter's normals (raw throughput). */
export const normalDps = (data: FighterData): number => {
  const normals = data.moves.filter((m) => m.kind === 'normal');
  const dps = normals.map((m) => (m.hit.damage * m.hits * data.stats.strength * FPS) / totalFrames(m));
  return dps.reduce((a, b) => a + b, 0) / Math.max(1, dps.length);
};

/** Effective health: how much raw damage the fighter can absorb. */
export const effectiveHealth = (data: FighterData): number => data.stats.health * data.stats.defense;

/** Maximum horizontal reach of the fighter's grounded normals. */
export const maxReach = (data: FighterData): number =>
  Math.max(
    ...data.moves
      .filter((m) => m.hitbox && m.context === 'ground' && m.kind === 'normal')
      .map((m) => (m.hitbox ? m.hitbox.x + m.hitbox.w : 0)),
  );

const scale = (value: number, min: number, max: number): number =>
  Math.round(clamp(1 + ((value - min) / (max - min)) * 9, 1, 10));

export const computeRatings = (data: FighterData): Ratings => ({
  power: scale(normalDps(data), 18, 30),
  defense: scale(effectiveHealth(data), 70, 140),
  speed: scale(data.stats.walkSpeed, 150, 290),
  range: scale(maxReach(data) + (data.moves.some((m) => m.projectile) ? 20 : 0), 80, 140),
  mobility: scale(data.stats.runSpeed + data.stats.airJumps * 120 + data.dodge.distance, 400, 860),
  technique: scale(lightChainLength(data) * 2 + data.moves.filter((m) => m.cancels.length > 0).length, 8, 16),
});
