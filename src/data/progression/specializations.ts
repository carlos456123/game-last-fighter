/**
 * Specializations unlocked by fighter mastery. Each fighter has two styles; Mastery II unlocks the
 * choice (tier 1) and Mastery III upgrades it (tier 2). Values are explicit per tier so balance can
 * be tuned in one place. Limits enforced by tests: multipliers within 0.9..1.1, frame changes ≤ 3,
 * extra hits/armor ≤ 1, and no modifier ever removes a weakness entirely.
 */
export type StatKey = 'walkSpeed' | 'backSpeed' | 'runSpeed' | 'defense' | 'strength';
export type MoveMultField =
  'damage' | 'cooldown' | 'energyCost' | 'recovery' | 'healthCost' | 'projectileSpeed' | 'projectileLifetime';
export type MoveFrameField = 'invulnTo' | 'counterTo' | 'armorTo' | 'startup';
export type MoveCountField = 'armorHits' | 'zoneHits';

export type SpecModifier =
  | { kind: 'stat'; key: StatKey; t1: number; t2: number }
  | { kind: 'moveMult'; moveId: string; field: MoveMultField; t1: number; t2: number }
  | { kind: 'moveFrames'; moveId: string; field: MoveFrameField; t1: number; t2: number }
  | { kind: 'moveCount'; moveId: string; field: MoveCountField; t1: number; t2: number }
  | { kind: 'dodgeMult'; field: 'distance' | 'cooldown'; t1: number; t2: number }
  | { kind: 'dodgeFrames'; field: 'invulnTo'; t1: number; t2: number };

export interface SpecializationDef {
  id: string;
  fighterId: string;
  nameKey: string;
  descKey: string;
  modifiers: SpecModifier[];
}

const spec = (fighterId: string, id: string, modifiers: SpecModifier[]): SpecializationDef => ({
  id,
  fighterId,
  nameKey: `specs.${id}.name`,
  descKey: `specs.${id}.desc`,
  modifiers,
});

export const SPECIALIZATIONS: readonly SpecializationDef[] = [
  spec('kael', 'kael_ember', [
    { kind: 'moveMult', moveId: 'kael_ember', field: 'cooldown', t1: 0.92, t2: 0.9 },
    { kind: 'moveMult', moveId: 'kael_ember', field: 'energyCost', t1: 0.95, t2: 0.9 },
  ]),
  spec('kael', 'kael_oath_guard', [
    { kind: 'moveFrames', moveId: 'kael_rising', field: 'invulnTo', t1: 1, t2: 2 },
    { kind: 'moveMult', moveId: 'kael_rising', field: 'recovery', t1: 0.95, t2: 0.92 },
  ]),
  spec('bronn', 'bronn_living_wall', [
    { kind: 'moveFrames', moveId: 'bronn_smash', field: 'armorTo', t1: 1, t2: 2 },
    { kind: 'moveCount', moveId: 'bronn_charge', field: 'armorHits', t1: 0, t2: 1 },
  ]),
  spec('bronn', 'bronn_forge_rhythm', [
    { kind: 'moveMult', moveId: 'bronn_smash', field: 'recovery', t1: 0.94, t2: 0.9 },
    { kind: 'moveMult', moveId: 'bronn_hammer', field: 'recovery', t1: 0.94, t2: 0.9 },
  ]),
  spec('nyx', 'nyx_swift_shadow', [
    { kind: 'stat', key: 'runSpeed', t1: 1.04, t2: 1.06 },
    { kind: 'dodgeMult', field: 'cooldown', t1: 0.94, t2: 0.9 },
  ]),
  spec('nyx', 'nyx_cruel_blades', [
    { kind: 'moveMult', moveId: 'nyx_spin', field: 'damage', t1: 1.06, t2: 1.1 },
    { kind: 'moveMult', moveId: 'nyx_slash3', field: 'damage', t1: 1.05, t2: 1.08 },
  ]),
  spec('ayame', 'ayame_leaf', [
    { kind: 'dodgeFrames', field: 'invulnTo', t1: 1, t2: 1 },
    { kind: 'dodgeMult', field: 'distance', t1: 1.04, t2: 1.07 },
  ]),
  spec('ayame', 'ayame_exact_cut', [
    { kind: 'moveMult', moveId: 'ayame_iai', field: 'recovery', t1: 0.94, t2: 0.9 },
    { kind: 'moveMult', moveId: 'ayame_iai', field: 'damage', t1: 1.04, t2: 1.07 },
  ]),
  spec('han', 'han_mountain', [{ kind: 'stat', key: 'defense', t1: 1.04, t2: 1.07 }]),
  spec('han', 'han_reading', [
    { kind: 'moveFrames', moveId: 'han_still_water', field: 'counterTo', t1: 2, t2: 3 },
    { kind: 'moveMult', moveId: 'han_still_water', field: 'cooldown', t1: 0.94, t2: 0.9 },
  ]),
  spec('r0n', 'ron_containment', [
    { kind: 'moveMult', moveId: 'ron_plasma', field: 'cooldown', t1: 0.93, t2: 0.9 },
    { kind: 'moveMult', moveId: 'ron_plasma', field: 'projectileSpeed', t1: 1.05, t2: 1.08 },
  ]),
  spec('r0n', 'ron_core', [
    { kind: 'moveMult', moveId: 'ron_plasma', field: 'energyCost', t1: 0.95, t2: 0.9 },
    { kind: 'moveMult', moveId: 'ron_booster', field: 'energyCost', t1: 0.95, t2: 0.9 },
  ]),
  spec('vesper', 'vesper_gravity_field', [
    { kind: 'moveMult', moveId: 'vesper_orb', field: 'projectileLifetime', t1: 1.06, t2: 1.1 },
    { kind: 'moveCount', moveId: 'vesper_orb', field: 'zoneHits', t1: 0, t2: 1 },
  ]),
  spec('vesper', 'vesper_swift_light', [
    { kind: 'moveMult', moveId: 'vesper_lance', field: 'cooldown', t1: 0.93, t2: 0.9 },
    { kind: 'moveMult', moveId: 'vesper_lance', field: 'damage', t1: 1.04, t2: 1.07 },
  ]),
  spec('dante', 'dante_fury', [
    { kind: 'moveMult', moveId: 'dante_rush', field: 'recovery', t1: 0.94, t2: 0.9 },
    { kind: 'moveMult', moveId: 'dante_knee', field: 'damage', t1: 1.05, t2: 1.08 },
  ]),
  spec('dante', 'dante_cold_blood', [
    { kind: 'moveMult', moveId: 'dante_pact', field: 'healthCost', t1: 0.9, t2: 0.9 },
    { kind: 'moveMult', moveId: 'dante_inferno', field: 'healthCost', t1: 0.9, t2: 0.9 },
    { kind: 'moveMult', moveId: 'dante_pact', field: 'recovery', t1: 1, t2: 0.94 },
  ]),
  spec('valkyrie', 'valk_arsenal', [
    { kind: 'stat', key: 'walkSpeed', t1: 1.04, t2: 1.06 },
    { kind: 'moveFrames', moveId: 'valk_thrust', field: 'startup', t1: 0, t2: -1 },
  ]),
  spec('valkyrie', 'valk_blessing', [
    { kind: 'moveMult', moveId: 'valk_javelin', field: 'cooldown', t1: 0.93, t2: 0.9 },
    { kind: 'moveMult', moveId: 'valk_aegis', field: 'cooldown', t1: 0.93, t2: 0.9 },
  ]),
];

export const specsFor = (fighterId: string): SpecializationDef[] =>
  SPECIALIZATIONS.filter((s) => s.fighterId === fighterId);

export const getSpec = (id: string): SpecializationDef | undefined =>
  SPECIALIZATIONS.find((s) => s.id === id);

/** Mastery XP thresholds for levels I, II and III. */
export const MASTERY = {
  thresholds: [0, 300, 900] as const,
  maxLevel: 3,
  winXp: 120,
  lossXp: 40,
  tournamentWinXp: 150,
} as const;

export const masteryLevel = (xp: number): number => {
  let level = 1;
  for (let i = 1; i < MASTERY.thresholds.length; i++) if (xp >= MASTERY.thresholds[i]) level = i + 1;
  return level;
};
