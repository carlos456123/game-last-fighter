import { describe, expect, it } from 'vitest';
import { EnemyAI } from '@/ai/EnemyAI';
import type { AIStateId } from '@/ai/AIState';
import { DIFFICULTY_PROFILES } from '@/ai/BehaviorProfile';
import { classifyMoves } from '@/ai/DecisionSystem';
import type { Difficulty } from '@/types';
import { Rng } from '@/utils/MathUtils';
import { idle, makeMatch, startFight } from './helpers';

const duel = (p1: string, p2: string, d1: Difficulty, d2: Difficulty, seed: number, frames = 60 * 60 * 4) => {
  const m = makeMatch(p1, p2);
  const world = { projectiles: m.combat.projectiles, bounds: m.bounds };
  const a = new EnemyAI(m.p1, m.p2, m.p1.data.ai, d1, world, new Rng(seed));
  const b = new EnemyAI(m.p2, m.p1, m.p2.data.ai, d2, world, new Rng(seed + 1));
  const states = new Set<AIStateId>();
  const moves = new Set<string>();
  m.events.on('moveStart', (e) => moves.add(e.move.slot));
  for (let f = 0; f < frames && !m.isOver; f++) {
    m.step(a.think(), b.think());
    states.add(a.state);
    states.add(b.state);
  }
  return { m, states, moves };
};

describe('EnemyAI', () => {
  it('two AIs finish a full match', () => {
    const { m } = duel('kael', 'bronn', 'normal', 'normal', 42);
    expect(m.isOver).toBe(true);
    expect(m.stats.p1.damageDealt + m.stats.p2.damageDealt).toBeGreaterThan(100);
  });

  it('uses many different behaviours, not only chasing', () => {
    const { states, moves } = duel('nyx', 'kael', 'hard', 'normal', 7);
    for (const s of ['OBSERVE', 'APPROACH', 'ATTACK', 'DEFEND', 'STUNNED'] as AIStateId[]) {
      expect(states.has(s)).toBe(true);
    }
    expect(moves.has('light')).toBe(true);
    expect(moves.has('skill') || moves.has('special')).toBe(true);
  });

  it('hard AI beats easy AI more often than not', () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { m } = duel('kael', 'kael', 'hard', 'easy', seed * 13);
      if (m.matchWinner === 'p1') hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(4);
  });

  it('difficulty changes reaction and decisions, not damage', () => {
    expect(DIFFICULTY_PROFILES.easy.reactionFrames).toBeGreaterThan(DIFFICULTY_PROFILES.hard.reactionFrames);
    expect(DIFFICULTY_PROFILES.easy.accuracy).toBeLessThan(DIFFICULTY_PROFILES.hard.accuracy);
    expect(Object.keys(DIFFICULTY_PROFILES.normal)).not.toContain('damage');
  });

  it('infers move roles from data for every fighter', () => {
    const m = makeMatch('kael', 'bronn');
    const kael = classifyMoves(m.p1);
    const bronn = classifyMoves(m.p2);
    expect(kael.zoning?.id).toBe('kael_ember');
    expect(kael.antiAir?.id).toBe('kael_rising');
    expect(bronn.approach?.id).toBe('bronn_charge');
    const nyx = classifyMoves(makeMatch('nyx').p1);
    expect(nyx.approach?.id).toBe('nyx_blink');
  });

  it('a disabled AI produces no input', () => {
    const m = makeMatch();
    startFight(m);
    const ai = new EnemyAI(m.p2, m.p1, m.p2.data.ai, 'hard', { projectiles: [], bounds: m.bounds });
    ai.enabled = false;
    for (let i = 0; i < 120; i++) {
      const out = ai.think();
      expect(Object.values(out.held).some(Boolean)).toBe(false);
      m.step(idle(), out);
    }
  });
});
