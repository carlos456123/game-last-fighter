import { getSpec, type SpecModifier } from '@/data/progression/specializations';
import type { FighterData, MoveData } from '@/types';

export type SpecTier = 0 | 1 | 2;

const roundFrames = (v: number, min: number): number => Math.max(min, Math.round(v));

const applyToMove = (move: MoveData, mod: SpecModifier, value: number): MoveData => {
  const m: MoveData = structuredClone(move);
  const total = m.startup + m.active + m.recovery;
  switch (mod.kind) {
    case 'moveMult':
      switch (mod.field) {
        case 'damage':
          m.hit.damage *= value;
          if (m.projectile) m.projectile.hit.damage *= value;
          if (m.counter) m.counter.hit.damage *= value;
          break;
        case 'cooldown':
          m.cooldown = roundFrames(m.cooldown * value, 1);
          break;
        case 'energyCost':
          m.energyCost = Math.round(m.energyCost * value);
          break;
        case 'recovery':
          m.recovery = roundFrames(m.recovery * value, 1);
          break;
        case 'healthCost':
          if (m.healthCost !== undefined) m.healthCost = Math.round(m.healthCost * value);
          break;
        case 'projectileSpeed':
          if (m.projectile) m.projectile.speed *= value;
          break;
        case 'projectileLifetime':
          if (m.projectile) m.projectile.lifetime = roundFrames(m.projectile.lifetime * value, 1);
          break;
      }
      break;
    case 'moveFrames':
      switch (mod.field) {
        case 'startup':
          m.startup = roundFrames(m.startup + value, 1);
          break;
        case 'invulnTo':
          if (m.invulnerable) m.invulnerable.to = Math.min(total, m.invulnerable.to + value);
          break;
        case 'armorTo':
          if (m.armor) m.armor.to = Math.min(total, m.armor.to + value);
          break;
        case 'counterTo':
          // Extending the stance also lengthens the active window so it stays inside the move.
          if (m.counter) {
            m.counter.to += value;
            m.active += value;
          }
          break;
      }
      break;
    case 'moveCount':
      if (mod.field === 'armorHits' && m.armor) m.armor.hits += value;
      if (mod.field === 'zoneHits' && m.projectile?.persistent) m.projectile.persistent.hits += value;
      break;
    default:
      break;
  }
  return m;
};

/**
 * Returns a copy of the fighter with the specialization applied at the given tier.
 * Tier 0 (or no spec) returns the original data untouched, so modes with standardized
 * attributes simply skip this step.
 */
export const applySpecialization = (
  data: FighterData,
  specId: string | null,
  tier: SpecTier,
): FighterData => {
  const def = specId ? getSpec(specId) : undefined;
  if (!def || def.fighterId !== data.id || tier === 0) return data;
  const out: FighterData = {
    ...data,
    stats: { ...data.stats },
    dodge: structuredClone(data.dodge),
    moves: [...data.moves],
  };
  for (const mod of def.modifiers) {
    const value = tier === 1 ? mod.t1 : mod.t2;
    switch (mod.kind) {
      case 'stat':
        out.stats[mod.key] *= value;
        break;
      case 'dodgeMult':
        if (mod.field === 'distance') out.dodge.distance *= value;
        else out.dodge.cooldown = roundFrames(out.dodge.cooldown * value, 1);
        break;
      case 'dodgeFrames':
        out.dodge.invulnerable.to = Math.min(out.dodge.duration, out.dodge.invulnerable.to + value);
        break;
      default: {
        const index = out.moves.findIndex((m) => m.id === mod.moveId);
        if (index >= 0) out.moves[index] = applyToMove(out.moves[index], mod, value);
      }
    }
  }
  return out;
};
