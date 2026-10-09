import { describe, expect, it } from 'vitest';
import { createShadowVariant, validateFighter } from '@/characters/CharacterFactory';
import { computeRatings, effectiveHealth, lightChainDamage, normalDps } from '@/characters/CharacterStats';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';

describe('Fighter data', () => {
  it.each(FIGHTERS.map((f) => [f.id, f] as const))('%s has valid data', (_id, fighter) => {
    expect(validateFighter(fighter)).toEqual([]);
  });

  it('every fighter has a distinct archetype and silhouette', () => {
    expect(new Set(FIGHTERS.map((f) => f.archetype)).size).toBe(FIGHTERS.length);
    const silhouettes = FIGHTERS.map((f) => `${f.body.height}-${f.body.width}-${f.body.features.join()}`);
    expect(new Set(silhouettes).size).toBe(FIGHTERS.length);
  });

  it('fighters differ mechanically, not just by colour', () => {
    const signature = (id: string): string => {
      const f = FIGHTERS.find((x) => x.id === id)!;
      return JSON.stringify([
        f.stats,
        f.dodge,
        f.moves.map((m) => [m.startup, m.active, m.recovery, m.hit.damage]),
      ]);
    };
    const sigs = FIGHTERS.map((f) => signature(f.id));
    expect(new Set(sigs).size).toBe(FIGHTERS.length);
  });

  it('each fighter has 2 specials and 1 ultimate', () => {
    for (const f of FIGHTERS) {
      expect(f.moves.filter((m) => m.kind === 'special')).toHaveLength(2);
      expect(f.moves.filter((m) => m.kind === 'ultimate')).toHaveLength(1);
    }
  });

  it('shadow boss keeps moves but changes palette and AI', () => {
    const base = FIGHTERS[0];
    const shadow = createShadowVariant(base);
    expect(shadow.moves).toBe(base.moves);
    expect(shadow.palette.primary).not.toBe(base.palette.primary);
    expect(shadow.ai.aggression).toBeGreaterThan(base.ai.aggression);
  });
});

describe('Balance (measurable)', () => {
  it('light-chain presses to KO stay within a fair band', () => {
    const presses = FIGHTERS.map((attacker) => {
      const perDefender = FIGHTERS.map((defender) => effectiveHealth(defender) / lightChainDamage(attacker));
      return perDefender.reduce((a, b) => a + b, 0) / perDefender.length;
    });
    const min = Math.min(...presses);
    const max = Math.max(...presses);
    expect(max / min).toBeLessThan(1.6);
  });

  it('time-to-kill with normals is within ±30% of the reference fighter', () => {
    const ttk = FIGHTERS.map((a) => {
      const avgEhp = FIGHTERS.reduce((acc, d) => acc + effectiveHealth(d), 0) / FIGHTERS.length;
      return avgEhp / normalDps(a);
    });
    const ref = ttk[0];
    for (const t of ttk) expect(Math.abs(t - ref) / ref).toBeLessThan(0.3);
  });

  it('nobody is strictly better in every rating', () => {
    const ratings = FIGHTERS.map(computeRatings);
    for (let i = 0; i < ratings.length; i++) {
      for (let j = 0; j < ratings.length; j++) {
        if (i === j) continue;
        const keys = Object.keys(ratings[i]) as Array<keyof (typeof ratings)[number]>;
        const dominates = keys.every((k) => ratings[i][k] >= ratings[j][k]);
        expect(dominates).toBe(false);
      }
    }
  });

  it('ratings are in the 1..10 range', () => {
    for (const f of FIGHTERS) {
      for (const v of Object.values(computeRatings(f))) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('Arena data', () => {
  it('spawns lie inside bounds and bounds inside the world', () => {
    for (const a of ARENAS) {
      expect(a.bounds.left).toBeGreaterThanOrEqual(0);
      expect(a.bounds.right).toBeLessThanOrEqual(a.width);
      expect(a.spawn.p1).toBeGreaterThan(a.bounds.left);
      expect(a.spawn.p2).toBeLessThan(a.bounds.right);
      expect(a.spawn.p1).toBeLessThan(a.spawn.p2);
    }
  });
});
