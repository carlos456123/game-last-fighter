import type { HitProperties, MoveData, MoveKind, MoveSlot } from '@/types';

/**
 * Small helpers that fill sensible defaults so fighter files only state what makes each move unique.
 * They only build data; no behaviour lives here.
 */
export const hit = (overrides: Partial<HitProperties> & Pick<HitProperties, 'damage'>): HitProperties => ({
  chip: 0,
  stun: Math.round(overrides.damage * 1.5),
  hitstun: 14,
  blockstun: 10,
  knockback: 140,
  launch: 0,
  knockdown: false,
  level: 'mid',
  hitstop: 5,
  shake: 'none',
  energyGain: Math.round(overrides.damage * 0.8) + 2,
  vfx: 'spark_light',
  sfx: 'hit_light',
  ...overrides,
});

const kindForSlot = (slot: MoveSlot): MoveKind =>
  slot === 'ultimate' ? 'ultimate' : slot === 'skill' || slot === 'special' ? 'special' : 'normal';

type MoveInput = Partial<MoveData> &
  Pick<MoveData, 'id' | 'slot' | 'animation' | 'startup' | 'active' | 'recovery' | 'hit'>;

export const move = (input: MoveInput): MoveData => {
  const kind = input.kind ?? kindForSlot(input.slot);
  const isAir = input.slot === 'airLight' || input.slot === 'airHeavy';
  return {
    kind,
    context: isAir ? 'air' : 'ground',
    nameKey: `moves.${input.id}.name`,
    descKey: `moves.${input.id}.desc`,
    hits: 1,
    energyCost: 0,
    cooldown: 0,
    cancels: [],
    ...input,
  };
};

/** Standard cancel routes, kept in one place so all fighters follow the same rules. */
export const CANCELS = {
  light: ['heavy', 'skill', 'special', 'ultimate'] as MoveSlot[],
  heavy: ['skill', 'special', 'ultimate'] as MoveSlot[],
  special: ['ultimate'] as MoveSlot[],
  none: [] as MoveSlot[],
};
