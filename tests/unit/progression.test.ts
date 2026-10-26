import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION } from '@/config/gameConfig';
import { Match, type FighterMatchStats } from '@/core/Match';
import { applySpecialization } from '@/characters/Specialization';
import { getFighter, validateFighter } from '@/characters/CharacterFactory';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';
import { ACHIEVEMENTS, COMBO_MASTER_HITS } from '@/data/progression/achievements';
import { MASTERY, SPECIALIZATIONS, specsFor } from '@/data/progression/specializations';
import { UNLOCK_RULES } from '@/data/progression/unlocks';
import {
  ARCADE,
  ProgressionManager,
  buildLadder,
  chooseSpecialization,
  isUnlocked,
  levelForXp,
  levelProgress,
  masteryOf,
  specTier,
  unlockProgress,
  xpForLevel,
  type MatchRecord,
} from '@/systems/ProgressionManager';
import { SaveManager, createDefaultSave, type SaveData, type StorageLike } from '@/systems/SaveManager';
import {
  championOf,
  createTournament,
  currentOpponent,
  playerMatch,
  resolvePlayerMatch,
  sanitizeTournament,
} from '@/systems/TournamentManager';
import { idle, input, makeMatch, placeAt, startFight } from './helpers';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const stats = (o: Partial<FighterMatchStats> = {}): FighterMatchStats => ({
  damageDealt: 100,
  damageTaken: 30,
  maxCombo: 3,
  hitsLanded: 10,
  skillsUsed: 1,
  ultimatesUsed: 0,
  blocks: 2,
  perfectDodges: 0,
  counters: 0,
  ...o,
});

let nextId = 0;
const rec = (o: Partial<MatchRecord> = {}): MatchRecord => ({
  matchId: `m${++nextId}`,
  mode: 'arcade',
  won: true,
  fighterId: 'kael',
  arenaId: 'colosseum',
  stats: stats(),
  roundsLost: 1,
  durationSeconds: 90,
  shadow: false,
  stage: 0,
  tournamentChampion: false,
  ...o,
});

const pm = new ProgressionManager(FIGHTERS, ARENAS);
const ids = FIGHTERS.map((f) => f.id);

describe('Unlocks', () => {
  it('starts with only Kael and Bronn', () => {
    const save = createDefaultSave();
    expect(FIGHTERS.filter((f) => isUnlocked(save, f)).map((f) => f.id)).toEqual(['kael', 'bronn']);
  });

  it('Nyx unlocks after two valid Arcade wins and keeps the existing rule', () => {
    const save = createDefaultSave();
    const nyx = getFighter('nyx');
    pm.recordMatch(save, rec());
    expect(unlockProgress(save, nyx)).toEqual({ current: 1, required: 2 });
    const r = pm.recordMatch(save, rec());
    expect(r.unlocked).toContain('nyx');
    expect(isUnlocked(save, nyx)).toBe(true);
  });

  it('Ayame needs ten perfect dodges accumulated across valid matches', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec({ won: false, stats: stats({ perfectDodges: 6 }) }));
    expect(unlockProgress(save, getFighter('ayame'))).toEqual({ current: 6, required: 10 });
    const r = pm.recordMatch(save, rec({ won: false, stats: stats({ perfectDodges: 4 }) }));
    expect(r.unlocked).toContain('ayame');
  });

  it('Mestre Han needs five flawless wins', () => {
    const save = createDefaultSave();
    for (let i = 0; i < 4; i++) pm.recordMatch(save, rec({ roundsLost: 0 }));
    pm.recordMatch(save, rec({ roundsLost: 1 }));
    expect(save.progress.unlockedFighters).not.toContain('han');
    const r = pm.recordMatch(save, rec({ roundsLost: 0 }));
    expect(r.unlocked).toContain('han');
  });

  it('R-0N unlocks at player level 5', () => {
    const save = createDefaultSave();
    save.progress.xp = xpForLevel(5) - 10;
    expect(save.progress.unlockedFighters).not.toContain('r0n');
    const r = pm.recordMatch(save, rec({ won: false }));
    expect(levelForXp(save.progress.xp)).toBeGreaterThanOrEqual(5);
    expect(r.unlocked).toContain('r0n');
  });

  it('Vesper needs three consecutive Arcade wins (a loss resets the streak)', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec());
    pm.recordMatch(save, rec());
    pm.recordMatch(save, rec({ won: false }));
    expect(save.progress.arcadeStreak).toBe(0);
    pm.recordMatch(save, rec());
    pm.recordMatch(save, rec());
    expect(save.progress.unlockedFighters).not.toContain('vesper');
    const r = pm.recordMatch(save, rec());
    expect(r.unlocked).toContain('vesper');
  });

  it('Dante unlocks by defeating the Reflexo', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec({ shadow: true, won: false }));
    expect(save.progress.unlockedFighters).not.toContain('dante');
    const r = pm.recordMatch(save, rec({ shadow: true }));
    expect(r.unlocked).toContain('dante');
  });

  it('Valquíria only unlocks with a confirmed tournament title', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec({ mode: 'tournament', stage: 2, tournamentChampion: false }));
    expect(save.progress.unlockedFighters).not.toContain('valkyrie');
    const r = pm.recordMatch(save, rec({ mode: 'tournament', stage: 2, tournamentChampion: true }));
    expect(r.unlocked).toContain('valkyrie');
    expect(r.tournamentChampion).toBe(true);
  });

  it('never unlocks a fighter twice and never re-locks after a loss', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec());
    pm.recordMatch(save, rec());
    const again = pm.recordMatch(save, rec());
    expect(again.unlocked).not.toContain('nyx');
    pm.recordMatch(save, rec({ won: false }));
    expect(save.progress.unlockedFighters.filter((id) => id === 'nyx')).toHaveLength(1);
  });

  it('every unlock rule is centralized', () => {
    for (const f of FIGHTERS) expect(f.unlock).toBe(UNLOCK_RULES[f.id as keyof typeof UNLOCK_RULES]);
  });
});

describe('XP and rewards', () => {
  it('level curve is monotonic and level 5 needs a reasonable amount of XP', () => {
    for (let l = 1; l < 20; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    expect(xpForLevel(5)).toBe(2000);
    expect(levelProgress(xpForLevel(3) + 50)).toMatchObject({ level: 3, current: 50 });
  });

  it('a match id is rewarded only once (reload, double events)', () => {
    const save = createDefaultSave();
    const r = rec();
    const first = pm.recordMatch(save, r);
    const second = pm.recordMatch(save, r);
    expect(first.xp).toBeGreaterThan(0);
    expect(second.duplicate).toBe(true);
    expect(second.xp).toBe(0);
    expect(save.progress.wins).toBe(1);
  });

  it('losses give a small XP amount and reset the Arcade streak', () => {
    const save = createDefaultSave();
    const r = pm.recordMatch(save, rec({ won: false }));
    expect(r.xp).toBeGreaterThan(0);
    expect(r.xp).toBeLessThan(50);
  });

  it('advancing the Arcade pays more than a single win (no farming incentive)', () => {
    const save = createDefaultSave();
    pm.startLadder(save, 'kael');
    const stages = save.progress.ladder!.stages.length;
    let total = 0;
    for (let i = 0; i < stages; i++)
      total += pm.recordMatch(save, rec({ stage: i, shadow: i === stages - 1 })).xp;
    expect(total).toBeGreaterThan(stages * 150);
    expect(save.progress.laddersCleared).toBe(1);
  });

  it('records statistics', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec({ stats: stats({ maxCombo: 7, blocks: 5 }) }));
    expect(save.stats.bestCombo).toBe(7);
    expect(save.stats.blocks).toBe(5);
    expect(save.stats.perFighter.kael).toEqual({ wins: 1, losses: 0 });
  });
});

describe('Arcade ladder', () => {
  it('has five unique opponents and the Reflexo at the end', () => {
    const ladder = buildLadder('kael', FIGHTERS, ARENAS, 0);
    expect(ladder).toHaveLength(ARCADE.opponents + 1);
    const opponents = ladder.slice(0, -1).map((s) => s.opponentId);
    expect(new Set(opponents).size).toBe(ARCADE.opponents);
    expect(opponents).not.toContain('kael');
    expect(ladder[ladder.length - 1]).toMatchObject({ opponentId: 'kael', shadow: true });
  });

  it('rotates opponents between runs', () => {
    const a = buildLadder('kael', FIGHTERS, ARENAS, 0)
      .map((s) => s.opponentId)
      .join();
    const b = buildLadder('kael', FIGHTERS, ARENAS, 1)
      .map((s) => s.opponentId)
      .join();
    expect(a).not.toBe(b);
  });
});

describe('Mastery and specializations', () => {
  it('mastery grows per fighter and specializations require Mastery II', () => {
    const save = createDefaultSave();
    expect(chooseSpecialization(save, 'kael', 'kael_ember')).toBe(false);
    while (masteryOf(save, 'kael').level < 2) pm.recordMatch(save, rec());
    expect(masteryOf(save, 'bronn').xp).toBe(0);
    expect(chooseSpecialization(save, 'kael', 'bronn_living_wall')).toBe(false);
    expect(chooseSpecialization(save, 'kael', 'kael_ember')).toBe(true);
    expect(specTier(save, 'kael')).toBe(1);
    save.progress.mastery.kael.xp = MASTERY.thresholds[2];
    expect(specTier(save, 'kael')).toBe(2);
  });

  it('cannot specialize a locked fighter', () => {
    const save = createDefaultSave();
    save.progress.mastery.nyx = { xp: 5000, spec: null };
    expect(chooseSpecialization(save, 'nyx', 'nyx_swift_shadow')).toBe(false);
  });

  it('every fighter has exactly two specializations', () => {
    for (const id of ids) expect(specsFor(id)).toHaveLength(2);
  });

  it('bonuses stay within balance limits', () => {
    for (const s of SPECIALIZATIONS) {
      for (const m of s.modifiers) {
        for (const v of [m.t1, m.t2]) {
          if (m.kind === 'moveFrames' || m.kind === 'dodgeFrames') expect(Math.abs(v)).toBeLessThanOrEqual(3);
          else if (m.kind === 'moveCount') expect(Math.abs(v)).toBeLessThanOrEqual(1);
          else {
            expect(v, `${s.id}`).toBeGreaterThanOrEqual(0.9);
            expect(v, `${s.id}`).toBeLessThanOrEqual(1.1);
          }
        }
      }
    }
  });

  it('applied specializations keep fighter data valid and never cut recovery below 90%', () => {
    for (const s of SPECIALIZATIONS) {
      const base = getFighter(s.fighterId);
      for (const tier of [1, 2] as const) {
        const data = applySpecialization(base, s.id, tier);
        expect(validateFighter(data), `${s.id} t${tier}`).toEqual([]);
        for (const m of data.moves) {
          const orig = base.moves.find((x) => x.id === m.id)!;
          expect(m.recovery).toBeGreaterThanOrEqual(Math.floor(orig.recovery * 0.9));
        }
        // The base fighter object is never mutated.
        expect(getFighter(s.fighterId)).toBe(base);
      }
    }
    expect(applySpecialization(getFighter('kael'), 'kael_ember', 0)).toBe(getFighter('kael'));
  });

  it('a specialization changes the real simulation (Kael ember cooldown)', () => {
    const base = getFighter('kael');
    const spec = applySpecialization(base, 'kael_ember', 2);
    expect(spec.moves.find((m) => m.id === 'kael_ember')!.cooldown).toBeLessThan(
      base.moves.find((m) => m.id === 'kael_ember')!.cooldown,
    );
  });

  it('specialized fighters still cannot build infinite combos', () => {
    for (const s of SPECIALIZATIONS) {
      const data = applySpecialization(getFighter(s.fighterId), s.id, 2);
      const m2 = new Match({ p1: data, p2: getFighter('bronn'), arena: ARENAS[0] });
      startFight(m2);
      placeAt(m2, 75);
      let maxCombo = 0;
      m2.events.on('hit', (e) => (maxCombo = Math.max(maxCombo, e.combo)));
      const buttons = ['light', 'light', 'heavy', 'skill', 'special'] as const;
      let i = 0;
      for (let f = 0; f < 900 && m2.phase === 'fight'; f++) {
        m2.p1.skills.energy = 99;
        m2.step(input(['right'], f % 3 === 0 ? [buttons[i++ % buttons.length]] : []), idle());
      }
      expect(maxCombo, s.id).toBeLessThan(16);
    }
  });
});

describe('Achievements', () => {
  it('has the required catalog with stable ids', () => {
    const required = [
      'first_win',
      'win_streak',
      'perfect_dodge',
      'combo_master',
      'flawless',
      'shadow_hunter',
      'arena_champion',
      'absolute_mastery',
      'collector',
      'versatile',
    ];
    const catalog = ACHIEVEMENTS.map((a) => a.id);
    for (const id of required) expect(catalog).toContain(id);
    expect(new Set(catalog).size).toBe(catalog.length);
  });

  it('completes once, grants XP and titles, and survives repeated checks', () => {
    const save = createDefaultSave();
    const r = pm.recordMatch(save, rec());
    expect(r.achievements).toContain('first_win');
    expect(save.progress.achievements.first_win).toBeGreaterThan(0);
    const again = pm.recordMatch(save, rec());
    expect(again.achievements).not.toContain('first_win');
    expect(pm.checkAchievements(save).ids).toEqual([]);
  });

  it('combo master uses the defined threshold', () => {
    const save = createDefaultSave();
    pm.recordMatch(save, rec({ stats: stats({ maxCombo: COMBO_MASTER_HITS - 1 }) }));
    expect(save.progress.achievements.combo_master).toBeUndefined();
    const r = pm.recordMatch(save, rec({ stats: stats({ maxCombo: COMBO_MASTER_HITS }) }));
    expect(r.achievements).toContain('combo_master');
    expect(save.progress.titles).toContain('titles.combo_artist');
  });

  it('versatile counts different winning fighters', () => {
    const save = createDefaultSave();
    save.progress.unlockedFighters.push('nyx');
    pm.recordMatch(save, rec({ fighterId: 'kael' }));
    pm.recordMatch(save, rec({ fighterId: 'kael' }));
    pm.recordMatch(save, rec({ fighterId: 'bronn' }));
    expect(save.progress.achievements.versatile).toBeUndefined();
    const r = pm.recordMatch(save, rec({ fighterId: 'nyx' }));
    expect(r.achievements).toContain('versatile');
  });

  it('collector completes when the whole roster is unlocked', () => {
    const save = createDefaultSave();
    save.progress.unlockedFighters = [...ids];
    expect(pm.checkAchievements(save).ids).toContain('collector');
  });
});

describe('Save v2', () => {
  it('migrates a v1 save keeping wins, unlocks and settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        saveVersion: 1,
        settings: { musicVolume: 0.3 },
        progress: { xp: 500, wins: 3, losses: 1, unlockedFighters: ['kael', 'bronn', 'nyx'] },
        stats: { matches: 4, bestCombo: 6 },
      }),
    );
    const sm = new SaveManager(storage);
    const data = sm.load();
    expect(sm.lastIssue).toBe('migrated');
    expect(data.saveVersion).toBe(SAVE_VERSION);
    expect(data.progress.arcadeWins).toBe(3);
    expect(data.progress.unlockedFighters).toContain('nyx');
    expect(data.progress.mastery).toEqual({});
    expect(data.tournament).toBeNull();
    expect(data.settings.musicVolume).toBe(0.3);
  });

  it('recovers from a corrupt save using the last good copy', () => {
    const storage = new MemoryStorage();
    const a = new SaveManager(storage);
    a.load();
    a.update((d) => (d.progress.wins = 7));
    storage.setItem(SAVE_KEY, '{broken');
    const b = new SaveManager(storage);
    const data = b.load();
    expect(b.lastIssue).toBe('recovered');
    expect(data.progress.wins).toBe(7);
  });

  it('persists progression, mastery and tournament state', () => {
    const storage = new MemoryStorage();
    const a = new SaveManager(storage);
    a.load();
    a.update((d) => {
      pm.recordMatch(d, rec());
      d.tournament = createTournament(
        'kael',
        ids,
        ARENAS.map((x) => x.id),
        0,
        42,
      );
    });
    const data = new SaveManager(storage).load();
    expect(data.progress.wins).toBe(1);
    expect(data.progress.mastery.kael.xp).toBe(MASTERY.winXp);
    expect(data.tournament?.participants).toHaveLength(8);
    expect(data.progress.claimedMatches).toHaveLength(1);
  });

  it('rejects inconsistent tournament data instead of crashing', () => {
    const known = new Set(ids);
    expect(sanitizeTournament({ participants: ['kael'] }, known)).toBeNull();
    expect(sanitizeTournament({ participants: Array(8).fill('kael'), rounds: [] }, known)).toBeNull();
  });
});

describe('Tournament', () => {
  const arenas = ARENAS.map((a) => a.id);
  const strength = (): number => 10;

  it('creates a bracket of 8 unique fighters with the player in slot 0', () => {
    const t = createTournament('kael', ids, arenas, 0, 1);
    expect(t.participants).toHaveLength(8);
    expect(new Set(t.participants).size).toBe(8);
    expect(t.participants[0]).toBe('kael');
    expect(t.rounds[0]).toHaveLength(4);
  });

  it('excludes a different fighter in each edition', () => {
    const excluded = (edition: number): string =>
      ids.find((id) => !createTournament('kael', ids, arenas, edition, 3).participants.includes(id))!;
    expect(excluded(0)).not.toBe(excluded(1));
  });

  it('includes locked fighters as AI opponents without unlocking them', () => {
    const save = createDefaultSave();
    const t = createTournament('kael', ids, arenas, 0, 1);
    expect(t.participants.some((id) => !save.progress.unlockedFighters.includes(id))).toBe(true);
    expect(save.progress.unlockedFighters).toEqual(['kael', 'bronn']);
  });

  it('three wins make the player champion; the final is in the Santuário', () => {
    const t = createTournament('kael', ids, arenas, 0, 9);
    expect(resolvePlayerMatch(t, true, strength)).toBe(false);
    expect(t.round).toBe(1);
    expect(t.rounds[1]).toHaveLength(2);
    expect(resolvePlayerMatch(t, true, strength)).toBe(false);
    expect(playerMatch(t)?.arenaId).toBe('sanctuary');
    expect(resolvePlayerMatch(t, true, strength)).toBe(true);
    expect(t.status).toBe('champion');
    expect(championOf(t)).toBe('kael');
    expect(playerMatch(t)).toBeNull();
  });

  it('a loss eliminates the player but completes the bracket', () => {
    const t = createTournament('bronn', ids, arenas, 2, 5);
    const opponent = currentOpponent(t);
    resolvePlayerMatch(t, false, strength);
    expect(t.status).toBe('eliminated');
    expect(t.rounds).toHaveLength(3);
    expect(championOf(t)).not.toBe('bronn');
    expect(opponent).not.toBeNull();
  });

  it('results cannot be applied twice to a finished edition', () => {
    const t = createTournament('kael', ids, arenas, 0, 9);
    resolvePlayerMatch(t, false, strength);
    expect(resolvePlayerMatch(t, true, strength)).toBe(false);
    expect(t.status).toBe('eliminated');
  });
});

describe('Training gives nothing', () => {
  it('training matches are never recorded by the battle flow', () => {
    // The battle scene only calls recordMatch for ladder/tournament modes; training has no match end.
    const m = makeMatch('kael', 'kael', 'training');
    m.p2.health = 1;
    placeAt(m, 90);
    m.step(input([], ['light']), idle());
    for (let i = 0; i < 30; i++) m.step(idle(), idle());
    expect(m.isOver).toBe(false);
    const save: SaveData = createDefaultSave();
    expect(save.progress.xp).toBe(0);
  });
});
