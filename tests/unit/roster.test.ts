import { describe, expect, it } from 'vitest';
import { EnemyAI } from '@/ai/EnemyAI';
import { classifyMoves } from '@/ai/DecisionSystem';
import { FIGHTERS } from '@/data/characters';
import type { HitEvent } from '@/core/MatchEvents';
import { Rng } from '@/utils/MathUtils';
import { idle, input, makeMatch, placeAt, run, startFight } from './helpers';

const hits = (m: ReturnType<typeof makeMatch>): HitEvent[] => {
  const out: HitEvent[] = [];
  m.events.on('hit', (e) => out.push(e));
  return out;
};

describe('Expanded roster', () => {
  it('has exactly nine fighters with unique ids', () => {
    expect(FIGHTERS.map((f) => f.id)).toEqual([
      'kael',
      'bronn',
      'nyx',
      'ayame',
      'han',
      'r0n',
      'vesper',
      'dante',
      'valkyrie',
    ]);
  });

  it('every fighter can be simulated and lands its light attack', () => {
    for (const f of FIGHTERS) {
      const m = makeMatch(f.id, 'kael');
      startFight(m);
      placeAt(m, 85);
      const h = hits(m);
      m.step(input([], ['light']), idle());
      run(m, 14);
      expect(h.length, f.id).toBeGreaterThan(0);
    }
  });

  it.each(FIGHTERS.map((f) => f.id))('%s cannot create an infinite combo by mashing', (id) => {
    const m = makeMatch(id, 'bronn');
    startFight(m);
    placeAt(m, 75);
    let maxCombo = 0;
    m.events.on('hit', (e) => (maxCombo = Math.max(maxCombo, e.combo)));
    const buttons = ['light', 'light', 'heavy', 'skill', 'special', 'light'] as const;
    let i = 0;
    for (let f = 0; f < 1200 && m.phase === 'fight'; f++) {
      m.p1.skills.energy = 99;
      m.step(input(['right'], f % 3 === 0 ? [buttons[i++ % buttons.length]] : []), idle());
    }
    expect(maxCombo).toBeLessThan(16);
  });
});

describe('Counter stance (Mestre Han)', () => {
  it('absorbs a melee attack and strikes back', () => {
    const m = makeMatch('han', 'kael');
    startFight(m);
    placeAt(m, 90);
    m.p1.skills.energy = 100;
    const counters: string[] = [];
    m.events.on('counter', (e) => counters.push(e.fighter));
    const h = hits(m);
    m.step(input([], ['skill']), idle());
    run(m, 3);
    m.step(idle(), input([], ['light']));
    run(m, 20);
    expect(counters).toEqual(['p1']);
    expect(m.p1.health).toBe(m.p1.maxHealth);
    expect(h.some((e) => e.attacker === 'p1' && e.moveId === 'han_still_water')).toBe(true);
    expect(m.p2.health).toBeLessThan(m.p2.maxHealth);
  });

  it('is punishable when nobody attacks', () => {
    const m = makeMatch('han', 'kael');
    startFight(m);
    placeAt(m, 90);
    m.p1.skills.energy = 100;
    m.step(input([], ['skill']), idle());
    const stance = m.p1.moveForSlot('skill');
    run(m, stance.counter!.to + 2);
    // Stance over, still recovering: a jab now connects.
    expect(m.p1.move?.id).toBe(stance.id);
    const h = hits(m);
    m.step(idle(), input([], ['light']));
    run(m, 8);
    expect(h.some((e) => e.attacker === 'p2')).toBe(true);
  });

  it('counter ultimate starts a lock sequence on the attacker', () => {
    const m = makeMatch('han', 'kael');
    startFight(m);
    placeAt(m, 90);
    m.p1.skills.energy = 100;
    const h = hits(m);
    m.step(input([], ['ultimate']), idle());
    run(m, (m.p1.moveForSlot('ultimate').cinematicFreeze ?? 0) + 6);
    m.step(idle(), input([], ['light']));
    run(m, 160);
    const ult = h.filter((e) => e.attacker === 'p1' && e.ultimate);
    expect(ult.length).toBeGreaterThanOrEqual(m.p1.moveForSlot('ultimate').lock!.hits + 1);
  });
});

describe('Health cost (Dante)', () => {
  it('pays health to use the move but never KOs himself', () => {
    const m = makeMatch('dante', 'kael');
    startFight(m);
    placeAt(m, 400);
    m.p1.skills.energy = 100;
    const pact = m.p1.moveForSlot('special');
    m.step(input([], ['special']), idle());
    expect(m.p1.health).toBe(m.p1.maxHealth - pact.healthCost!);
    run(m, pact.cooldown + 10);
    m.p1.health = 3;
    m.step(input([], ['special']), idle());
    expect(m.p1.health).toBe(1);
    expect(m.p1.isKO).toBe(false);
  });
});

describe('Movement path (Ayame)', () => {
  it('Passo do Vento backs off invulnerable, then dashes forward', () => {
    const m = makeMatch('ayame', 'kael');
    startFight(m);
    placeAt(m, 300);
    m.p1.skills.energy = 100;
    const x0 = m.p1.x;
    m.step(input([], ['skill']), idle());
    run(m, 6);
    expect(m.p1.x).toBeLessThan(x0);
    expect(m.p1.isInvulnerable()).toBe(true);
    run(m, 12);
    expect(m.p1.x).toBeGreaterThan(x0);
  });
});

describe('Zone projectiles (Vesper)', () => {
  it('the gravitational orb hits several times before vanishing', () => {
    const m = makeMatch('vesper', 'bronn');
    startFight(m);
    placeAt(m, 160);
    m.p1.skills.energy = 100;
    const h = hits(m);
    m.step(input([], ['skill']), idle());
    run(m, 200);
    const orbHits = h.filter((e) => e.moveId === 'vesper_orb');
    expect(orbHits.length).toBeGreaterThanOrEqual(2);
    expect(orbHits.length).toBeLessThanOrEqual(3);
  });

  it('an orb absorbs an opposing fireball and keeps going', () => {
    const m = makeMatch('vesper', 'kael');
    startFight(m);
    placeAt(m, 700);
    m.p1.skills.energy = 100;
    m.p2.skills.energy = 100;
    m.step(input([], ['skill']), input([], ['skill']));
    run(m, 70);
    const orbs = m.combat.projectiles.filter((p) => p.owner === 'p1');
    expect(orbs.length).toBe(1);
    expect(m.combat.projectiles.some((p) => p.owner === 'p2')).toBe(false);
  });
});

describe('R-0N overload beam', () => {
  it('reaches across the arena and can be jumped', () => {
    const m = makeMatch('r0n', 'kael');
    startFight(m);
    placeAt(m, 600);
    m.p1.skills.energy = 100;
    const h = hits(m);
    m.step(input([], ['ultimate']), idle());
    run(m, 160);
    expect(h.filter((e) => e.moveId === 'ron_overload').length).toBeGreaterThan(0);
  });
});

describe('AI with the new roster', () => {
  it('infers move roles from data', () => {
    expect(classifyMoves(makeMatch('han').p1).counter?.id).toBe('han_still_water');
    expect(classifyMoves(makeMatch('r0n').p1).antiAir?.id).toBe('ron_booster');
    expect(classifyMoves(makeMatch('vesper').p1).zoning?.id).toBe('vesper_orb');
    expect(classifyMoves(makeMatch('ayame').p1).approach?.id).toBe('ayame_wind_step');
  });

  it.each(['ayame', 'han', 'r0n', 'vesper', 'dante', 'valkyrie'])(
    '%s AI finishes a match against Kael',
    (id) => {
      const m = makeMatch(id, 'kael');
      const world = { projectiles: m.combat.projectiles, bounds: m.bounds };
      const a = new EnemyAI(m.p1, m.p2, m.p1.data.ai, 'normal', world, new Rng(5));
      const b = new EnemyAI(m.p2, m.p1, m.p2.data.ai, 'normal', world, new Rng(6));
      for (let f = 0; f < 60 * 60 * 5 && !m.isOver; f++) m.step(a.think(), b.think());
      expect(m.isOver).toBe(true);
      expect(m.stats.p1.damageDealt).toBeGreaterThan(0);
    },
  );
});
