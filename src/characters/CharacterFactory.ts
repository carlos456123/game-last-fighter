import { FIGHTERS } from '@/data/characters';
import type { FighterData, MoveSlot, Palette } from '@/types';

const SLOTS: MoveSlot[] = [
  'light',
  'heavy',
  'crouchLight',
  'crouchHeavy',
  'airLight',
  'airHeavy',
  'skill',
  'special',
  'ultimate',
];

export const getFighter = (id: string): FighterData => {
  const fighter = FIGHTERS.find((f) => f.id === id);
  if (!fighter) throw new Error(`Unknown fighter "${id}"`);
  return fighter;
};

export const hasFighter = (id: string): boolean => FIGHTERS.some((f) => f.id === id);

/** Dark palette used by the final ladder boss "Reflexo" (a shadow of the player's fighter). */
const shadowPalette = (p: Palette): Palette => ({
  primary: 0x2a2a35,
  secondary: 0x111118,
  accent: p.energy,
  skin: 0x4b4b5c,
  hair: 0x0b0b10,
  outline: 0x000000,
  energy: p.energy,
});

/** Creates the mirror-boss variant. Same moves, stronger AI profile, shadow palette. */
export const createShadowVariant = (base: FighterData): FighterData => ({
  ...base,
  id: `${base.id}_shadow`,
  nameKey: 'fighters.shadow.name',
  titleKey: 'fighters.shadow.title',
  palette: shadowPalette(base.palette),
  ai: {
    ...base.ai,
    aggression: Math.min(100, base.ai.aggression + 15),
    defense: Math.min(100, base.ai.defense + 15),
    skillUsage: Math.min(100, base.ai.skillUsage + 10),
  },
});

/** Validates fighter data so broken content is caught by tests instead of at runtime. */
export const validateFighter = (data: FighterData): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const m of data.moves) {
    if (ids.has(m.id)) errors.push(`duplicate move id ${m.id}`);
    ids.add(m.id);
    if (m.startup < 1 || m.active < 1 || m.recovery < 0) errors.push(`${m.id}: invalid frame data`);
    if (!m.hitbox && !m.projectile) errors.push(`${m.id}: needs a hitbox or projectile`);
    if (m.hits < 1 || m.hits > m.active) errors.push(`${m.id}: hits must be within active frames`);
    if (m.chain && !data.moves.some((x) => x.id === m.chain))
      errors.push(`${m.id}: chain ${m.chain} missing`);
    if (m.chain === m.id) errors.push(`${m.id}: chains into itself`);
    if (m.energyCost < 0 || m.energyCost > 100) errors.push(`${m.id}: energy cost out of range`);
    if (m.kind === 'ultimate' && m.energyCost < 100) errors.push(`${m.id}: ultimate must cost a full bar`);
    if (m.kind === 'special' && m.energyCost <= 0) errors.push(`${m.id}: specials must cost energy`);
    if (m.kind === 'special' && m.cooldown <= 0) errors.push(`${m.id}: specials need a cooldown`);
    if (m.teleport && m.teleport.atFrame >= m.startup)
      errors.push(`${m.id}: teleport must happen in startup`);
  }
  for (const slot of SLOTS) {
    const id = data.slots[slot];
    const m = data.moves.find((x) => x.id === id);
    if (!m) errors.push(`slot ${slot} -> missing move ${id}`);
    else if (m.slot !== slot) errors.push(`slot ${slot} -> move ${id} has slot ${m.slot}`);
  }
  // Chains must terminate (no cycles).
  for (const m of data.moves) {
    const seen = new Set<string>();
    let cur: string | undefined = m.id;
    while (cur) {
      if (seen.has(cur)) {
        errors.push(`${m.id}: chain cycle`);
        break;
      }
      seen.add(cur);
      cur = data.moves.find((x) => x.id === cur)?.chain;
    }
  }
  return errors;
};
