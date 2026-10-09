import { describe, expect, it } from 'vitest';
import { MATCH } from '@/config/gameConfig';
import { idle, input, makeMatch, placeAt, run, startFight } from './helpers';

describe('Match flow', () => {
  it('counts down 3, 2, 1 before the fight and ignores inputs meanwhile', () => {
    const m = makeMatch();
    const values: number[] = [];
    let fight = 0;
    m.events.on('countdown', (e) => values.push(e.value));
    m.events.on('fight', () => fight++);
    const x0 = m.p1.x;
    run(m, MATCH.countdownStepFrames * 3, () => input(['right']));
    expect(values).toEqual([3, 2, 1]);
    expect(fight).toBe(1);
    expect(m.p1.x).toBe(x0);
    expect(m.phase).toBe('fight');
  });

  it('KO ends the round and awards a win', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 90);
    m.p2.health = 1;
    const kos: Array<string | null> = [];
    m.events.on('ko', (e) => kos.push(e.winner));
    m.step(input([], ['light']), idle());
    run(m, 20);
    expect(kos).toEqual(['p1']);
    expect(m.wins).toEqual([1, 0]);
    expect(m.phase).toBe('ko');
  });

  it('winning the required rounds ends the match (victory condition)', () => {
    const m = makeMatch();
    let winner: string | null | undefined;
    m.events.on('matchEnd', (e) => (winner = e.winner));
    for (let round = 0; round < MATCH.roundsToWin; round++) {
      startFight(m);
      placeAt(m, 90);
      m.p2.health = 1;
      m.step(input([], ['light']), idle());
      run(m, MATCH.roundEndFrames + MATCH.koHitstop + 40);
    }
    expect(m.phase).toBe('matchEnd');
    expect(winner).toBe('p1');
    expect(m.p1.state).toBe('VICTORY');
    expect(m.p2.state).toBe('DEFEAT');
  });

  it('losing all rounds is a defeat for the player', () => {
    const m = makeMatch();
    let winner: string | null | undefined;
    m.events.on('matchEnd', (e) => (winner = e.winner));
    for (let round = 0; round < MATCH.roundsToWin; round++) {
      startFight(m);
      placeAt(m, 90);
      m.p1.health = 1;
      m.step(idle(), input([], ['light']));
      run(m, MATCH.roundEndFrames + MATCH.koHitstop + 40);
    }
    expect(winner).toBe('p2');
  });

  it('time out gives the round to the fighter with more health', () => {
    const m = makeMatch();
    startFight(m);
    m.p1.health = 50;
    const kos: Array<{ winner: string | null; reason: string }> = [];
    m.events.on('ko', (e) => kos.push(e));
    run(m, MATCH.roundTimeSeconds * 60 + 2);
    expect(kos).toEqual([{ winner: 'p2', reason: 'time' }]);
  });

  it('a new round resets health and positions', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 90);
    m.p2.health = 1;
    m.step(input([], ['light']), idle());
    run(m, MATCH.roundEndFrames + MATCH.koHitstop + 10);
    expect(m.round).toBe(2);
    expect(m.p2.health).toBe(m.p2.maxHealth);
    expect(m.p1.x).toBe(m.arena.spawn.p1);
    expect(m.phase).toBe('countdown');
  });

  it('training mode never ends and regenerates health', () => {
    const m = makeMatch('kael', 'kael', 'training');
    expect(m.phase).toBe('fight');
    placeAt(m, 90);
    m.p2.health = 1;
    m.step(input([], ['light']), idle());
    run(m, 20);
    expect(m.p2.health).toBeGreaterThanOrEqual(1);
    expect(m.phase).toBe('fight');
    run(m, 200);
    expect(m.p2.health).toBe(m.p2.maxHealth);
  });

  it('tracks match statistics', () => {
    const m = makeMatch();
    startFight(m);
    placeAt(m, 80);
    m.step(input([], ['light']), idle());
    run(m, 6);
    m.step(input([], ['light']), idle());
    run(m, 30);
    expect(m.stats.p1.hitsLanded).toBe(2);
    expect(m.stats.p1.maxCombo).toBe(2);
    expect(m.stats.p2.damageTaken).toBe(m.stats.p1.damageDealt);
    expect(m.stats.p2.damageTaken).toBe(m.p2.maxHealth - m.p2.health);
  });
});
