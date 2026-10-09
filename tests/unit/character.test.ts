import { describe, expect, it } from 'vitest';
import { idle, input, makeMatch, placeAt, run, startFight } from './helpers';

describe('Character movement', () => {
  it('walks forward and backward at data-driven speeds', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 400);
    const x0 = m.p1.x;
    run(m, 30, () => input(['right']));
    expect(m.p1.state).toBe('WALK');
    expect(m.p1.x - x0).toBeCloseTo((m.p1.data.stats.walkSpeed * 30) / 60, 0);
    const x1 = m.p1.x;
    run(m, 30, () => input(['left']));
    expect(x1 - m.p1.x).toBeCloseTo((m.p1.data.stats.backSpeed * 30) / 60, 0);
  });

  it('runs after a double tap forward', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 600);
    m.step(input([], ['right']), idle());
    m.step(idle(), idle());
    m.step(input([], ['right']), idle());
    m.step(input(['right']), idle());
    expect(m.p1.state).toBe('RUN');
  });

  it('jumps, reaches height and lands back in neutral', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 500);
    m.step(input([], ['up']), idle());
    let maxY = 0;
    for (let i = 0; i < 80; i++) {
      m.step(idle(), idle());
      maxY = Math.max(maxY, m.p1.y);
    }
    expect(maxY).toBeGreaterThan(150);
    expect(m.p1.y).toBe(0);
    expect(['IDLE', 'WALK']).toContain(m.p1.state);
  });

  it('crouches while down is held and lowers the hurtbox', () => {
    const m = makeMatch();
    startFight(m);
    const standing = m.p1.hurtboxes()[0].h;
    m.step(input(['down']), idle());
    expect(m.p1.state).toBe('CROUCH');
    expect(m.p1.hurtboxes()[0].h).toBeLessThan(standing);
  });

  it('keeps fighters inside the arena bounds', () => {
    const m = makeMatch();
    startFight(m);
    run(m, 600, () => input(['left']));
    expect(m.p1.x).toBeGreaterThanOrEqual(m.bounds.left);
  });

  it('pushboxes keep fighters from overlapping', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 200);
    run(
      m,
      120,
      () => input(['right']),
      () => input(['left']),
    );
    const minGap = (m.p1.pushbox().w + m.p2.pushbox().w) / 2 - 1;
    expect(m.p2.x - m.p1.x).toBeGreaterThanOrEqual(minGap);
  });
});

describe('Frame data', () => {
  it('a move is active exactly after its startup', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 600);
    m.step(input([], ['light']), idle());
    const jab = m.p1.moveForSlot('light');
    expect(m.p1.state).toBe('ATTACK');
    // The press tick is startup frame 0; `startup` frames pass before the first active frame.
    for (let f = 0; f < jab.startup; f++) {
      expect(m.p1.movePhase).toBe('startup');
      m.step(idle(), idle());
    }
    expect(m.p1.movePhase).toBe('active');
    expect(m.p1.hitbox()).not.toBeNull();
    for (let f = 0; f < jab.active; f++) m.step(idle(), idle());
    expect(m.p1.movePhase).toBe('recovery');
    expect(m.p1.hitbox()).toBeNull();
    run(m, jab.recovery + 1);
    expect(m.p1.state).toBe('IDLE');
  });

  it('buffers an attack pressed during recovery', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 600);
    m.step(input([], ['heavy']), idle());
    const heavy = m.p1.moveForSlot('heavy');
    run(m, heavy.startup + heavy.active + heavy.recovery - 4);
    m.step(input([], ['light']), idle());
    run(m, 6);
    expect(m.p1.move?.slot).toBe('light');
  });
});

describe('Energy and cooldowns', () => {
  it('denies skills without energy and reports why', () => {
    const m = makeMatch();
    startFight(m);
    m.p1.skills.energy = 0;
    const denied: string[] = [];
    m.events.on('denied', (e) => denied.push(e.reason));
    m.step(input([], ['skill']), idle());
    expect(m.p1.state).not.toBe('SPECIAL');
    expect(denied).toEqual(['energy']);
  });

  it('spends energy, starts a cooldown and blocks reuse until it expires', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 900);
    m.p1.skills.energy = 100;
    m.step(input([], ['skill']), idle());
    const ember = m.p1.moveForSlot('skill');
    expect(m.p1.state).toBe('SPECIAL');
    expect(m.p1.energy).toBe(100 - ember.energyCost);
    run(m, ember.startup + ember.active + ember.recovery + 2);
    const denied: string[] = [];
    m.events.on('denied', (e) => denied.push(e.reason));
    m.step(input([], ['skill']), idle());
    expect(denied).toEqual(['cooldown']);
    run(m, ember.cooldown);
    m.step(input([], ['skill']), idle());
    expect(m.p1.state).toBe('SPECIAL');
  });

  it('ultimate requires a full bar', () => {
    const m = makeMatch();
    startFight(m);
    m.p1.skills.energy = 99;
    m.step(input([], ['ultimate']), idle());
    expect(m.p1.state).not.toBe('ULTIMATE');
    m.p1.skills.energy = 100;
    run(m, 10);
    m.step(input([], ['ultimate']), idle());
    expect(m.p1.state).toBe('ULTIMATE');
    expect(m.superFreeze).toBeGreaterThan(0);
  });
});

describe('Dodge', () => {
  it('block + direction dodges with invulnerability frames', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 400);
    m.step(input(['left'], ['block']), idle());
    expect(m.p1.state).toBe('DODGE');
    run(m, m.p1.data.dodge.invulnerable.from);
    expect(m.p1.isInvulnerable()).toBe(true);
    run(m, m.p1.data.dodge.duration);
    expect(m.p1.state).not.toBe('DODGE');
    expect(m.p1.isInvulnerable()).toBe(false);
  });
});
