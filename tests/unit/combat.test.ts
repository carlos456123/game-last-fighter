import { describe, expect, it } from 'vitest';
import type { HitEvent } from '@/core/MatchEvents';
import { idle, input, makeMatch, placeAt, run, startFight } from './helpers';

const collectHits = (m: ReturnType<typeof makeMatch>): HitEvent[] => {
  const hits: HitEvent[] = [];
  m.events.on('hit', (e) => hits.push(e));
  return hits;
};

describe('Hit detection and damage', () => {
  it('a jab in range damages the opponent', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 90);
    const hits = collectHits(m);
    m.step(input([], ['light']), idle());
    run(m, 10);
    expect(hits).toHaveLength(1);
    expect(m.p2.health).toBe(m.p2.maxHealth - hits[0].damage);
    expect(m.p2.state).toBe('HIT');
  });

  it('a jab out of range whiffs', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 400);
    const hits = collectHits(m);
    const whiffs: string[] = [];
    m.events.on('whiff', (e) => whiffs.push(e.moveId));
    m.step(input([], ['light']), idle());
    run(m, 20);
    expect(hits).toHaveLength(0);
    expect(whiffs).toEqual(['kael_jab']);
  });

  it('standing block stops mid attacks with no damage for normals', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 90);
    const blocks: number[] = [];
    m.events.on('block', (e) => blocks.push(e.chip));
    m.step(input([], ['light']), input(['block']));
    run(m, 10, idle, () => input(['block']));
    expect(blocks).toHaveLength(1);
    expect(m.p2.health).toBe(m.p2.maxHealth);
    expect(m.p2.blockstun).toBeGreaterThanOrEqual(0);
  });

  it('low attacks must be blocked crouching', () => {
    const standing = makeMatch();
    startFight(standing);
    placeAt(standing, 100);
    const hits = collectHits(standing);
    standing.step(input(['down'], ['heavy']), input(['block']));
    run(
      standing,
      14,
      () => input(['down']),
      () => input(['block']),
    );
    expect(hits).toHaveLength(1);

    const crouching = makeMatch();
    startFight(crouching);
    placeAt(crouching, 100);
    const blocks: number[] = [];
    crouching.events.on('block', (e) => blocks.push(e.chip));
    crouching.step(input(['down'], ['heavy']), input(['block', 'down']));
    run(
      crouching,
      14,
      () => input(['down']),
      () => input(['block', 'down']),
    );
    expect(blocks).toHaveLength(1);
  });

  it('projectiles deal chip damage when blocked', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 500);
    m.p1.skills.energy = 100;
    const blocks: number[] = [];
    m.events.on('block', (e) => blocks.push(e.chip));
    m.step(input([], ['skill']), input(['block']));
    run(m, 90, idle, () => input(['block']));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBeGreaterThan(0);
    expect(m.p2.health).toBe(m.p2.maxHealth - blocks[0]);
  });

  it('armor absorbs a hit without interrupting the move', () => {
    const m = makeMatch('kael', 'bronn');
    startFight(m);
    placeAt(m, 90);
    // Bronn starts his armored heavy, Kael jabs into the armor.
    m.step(idle(), input([], ['heavy']));
    run(m, 2);
    const hits = collectHits(m);
    m.step(input([], ['light']), idle());
    run(m, 6);
    const armored = hits.find((h) => h.armored);
    expect(armored).toBeDefined();
    expect(m.p2.move?.slot).toBe('heavy');
  });

  it('dodging through an attack is a perfect dodge and grants energy', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 90);
    m.p2.skills.energy = 0;
    const perfect: string[] = [];
    m.events.on('perfectDodge', (e) => perfect.push(e.fighter));
    const jab = m.p1.moveForSlot('light');
    m.step(input([], ['light']), idle());
    run(m, jab.startup - 3);
    m.step(idle(), input(['right'], ['block']));
    run(m, 8);
    expect(perfect).toEqual(['p2']);
    expect(m.p2.energy).toBeGreaterThan(0);
    expect(m.p2.health).toBe(m.p2.maxHealth);
  });
});

describe('Combos', () => {
  const doChain = (m: ReturnType<typeof makeMatch>, presses: number): void => {
    for (let i = 0; i < presses; i++) {
      m.step(input([], ['light']), idle());
      run(m, 6);
    }
  };

  it('chains lights on hit and counts the combo', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 80);
    const hits = collectHits(m);
    doChain(m, 3);
    run(m, 10);
    expect(hits.map((h) => h.combo)).toEqual([1, 2, 3]);
    expect(hits.map((h) => h.moveId)).toEqual(['kael_jab', 'kael_cross', 'kael_roundhouse']);
  });

  it('emits comboEnd when the defender recovers', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 80);
    const ends: number[] = [];
    m.events.on('comboEnd', (e) => ends.push(e.count));
    doChain(m, 3);
    run(m, 60);
    expect(ends).toEqual([3]);
  });

  it('later combo hits deal scaled damage', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 80);
    const hits = collectHits(m);
    doChain(m, 3);
    run(m, 10);
    const raw = m.p1.moves.get('kael_roundhouse')!.hit.damage;
    expect(hits[2].damage).toBeLessThan(raw);
  });

  it('mashing every button cannot create an infinite combo', () => {
    const m = makeMatch('nyx', 'kael');
    startFight(m);
    placeAt(m, 70);
    let maxCombo = 0;
    m.events.on('hit', (e) => (maxCombo = Math.max(maxCombo, e.combo)));
    const buttons = ['light', 'light', 'heavy', 'skill', 'special', 'light'] as const;
    let i = 0;
    for (let f = 0; f < 1200; f++) {
      m.p1.skills.energy = 99; // plenty of energy, but not ultimate
      m.step(input(['right'], f % 3 === 0 ? [buttons[i++ % buttons.length]] : []), idle());
      if (m.phase !== 'fight') break;
    }
    expect(maxCombo).toBeGreaterThan(3);
    expect(maxCombo).toBeLessThan(16);
  });
});

describe('Ultimates', () => {
  it('Kael ultimate locks the defender into a multi-hit sequence', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 120);
    m.p1.skills.energy = 100;
    const hits = collectHits(m);
    m.step(input([], ['ultimate']), idle());
    run(m, 200);
    const ult = hits.filter((h) => h.ultimate);
    const lock = m.p1.moves.get('kael_oath')!.lock!;
    expect(ult.length).toBe(lock.hits + 2);
    expect(m.p1.energy).toBeLessThan(100);
    expect(['KNOCKDOWN', 'IDLE']).toContain(m.p2.state);
  });

  it('Bronn quake can be avoided by jumping', () => {
    const m = makeMatch('bronn', 'kael');
    startFight(m);
    placeAt(m, 300);
    m.p1.skills.energy = 100;
    const hits = collectHits(m);
    m.step(input([], ['ultimate']), idle());
    const ult = m.p1.moveForSlot('ultimate');
    // Wait for the freeze, then jump right before the active frames.
    run(m, (ult.cinematicFreeze ?? 0) + ult.startup - 12);
    m.step(idle(), input([], ['up']));
    run(m, 30);
    expect(hits.filter((h) => h.ultimate)).toHaveLength(0);
  });
});
