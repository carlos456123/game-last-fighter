import { DEFAULT_CONTROLS, DEFAULT_SETTINGS, SAVE_KEY, SAVE_VERSION } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { ALL_ACTIONS, type ControlBindings, type Settings } from '@/types';
import { sanitizeTournament, type TournamentState } from './TournamentManager';
import { Logger } from '@/utils/Logger';
import { clamp } from '@/utils/MathUtils';

export interface LadderStage {
  opponentId: string;
  arenaId: string;
  shadow: boolean;
}

export interface LadderState {
  fighterId: string;
  stage: number;
  stages: LadderStage[];
}

export interface MasteryData {
  xp: number;
  /** Chosen specialization id (available from Mastery II). */
  spec: string | null;
}

export interface RewardLogEntry {
  key: string;
  params: Record<string, string | number>;
  at: number;
}

export interface ProgressData {
  xp: number;
  /** All valid wins (Arcade + tournament). */
  wins: number;
  losses: number;
  laddersCleared: number;
  laddersStarted: number;
  unlockedFighters: string[];
  ladder: LadderState | null;
  arcadeWins: number;
  arcadeStreak: number;
  bestArcadeStreak: number;
  flawlessWins: number;
  perfectDodges: number;
  shadowWins: number;
  tournamentsWon: number;
  tournamentEditions: number;
  winningFighters: string[];
  winningArenas: string[];
  /** Ids of matches already rewarded (prevents duplicate rewards after reloads). */
  claimedMatches: string[];
  /** Achievement id -> completion timestamp (ms). */
  achievements: Record<string, number>;
  mastery: Record<string, MasteryData>;
  titles: string[];
  activeTitle: string | null;
  recentRewards: RewardLogEntry[];
}

export interface StatsData {
  matches: number;
  damageDealt: number;
  damageTaken: number;
  bestCombo: number;
  skillsUsed: number;
  ultimatesUsed: number;
  playSeconds: number;
  blocks: number;
  counters: number;
  perFighter: Record<string, { wins: number; losses: number }>;
}

export interface SaveData {
  saveVersion: number;
  settings: Settings;
  controls: ControlBindings;
  progress: ProgressData;
  stats: StatsData;
  tournament: TournamentState | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadIssue = 'none' | 'empty' | 'corrupt' | 'recovered' | 'future_version' | 'migrated';

/** How many rewarded match ids are remembered to block duplicates. */
const CLAIMED_MATCH_MEMORY = 200;
const RECENT_REWARDS = 12;
export const SAVE_LIMITS = { claimedMatches: CLAIMED_MATCH_MEMORY, recentRewards: RECENT_REWARDS } as const;

const defaultUnlocked = (): string[] => FIGHTERS.filter((f) => f.unlock.type === 'default').map((f) => f.id);

export const createDefaultSave = (): SaveData => ({
  saveVersion: SAVE_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  controls: cloneControls(DEFAULT_CONTROLS),
  progress: {
    xp: 0,
    wins: 0,
    losses: 0,
    laddersCleared: 0,
    laddersStarted: 0,
    unlockedFighters: defaultUnlocked(),
    ladder: null,
    arcadeWins: 0,
    arcadeStreak: 0,
    bestArcadeStreak: 0,
    flawlessWins: 0,
    perfectDodges: 0,
    shadowWins: 0,
    tournamentsWon: 0,
    tournamentEditions: 0,
    winningFighters: [],
    winningArenas: [],
    claimedMatches: [],
    achievements: {},
    mastery: {},
    titles: [],
    activeTitle: null,
    recentRewards: [],
  },
  stats: {
    matches: 0,
    damageDealt: 0,
    damageTaken: 0,
    bestCombo: 0,
    skillsUsed: 0,
    ultimatesUsed: 0,
    playSeconds: 0,
    blocks: 0,
    counters: 0,
    perFighter: {},
  },
  tournament: null,
});

const cloneControls = (c: ControlBindings): ControlBindings => {
  const out = {} as ControlBindings;
  for (const a of ALL_ACTIONS) out[a] = [...c[a]];
  return out;
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Migrations from version N to N+1. Version 0 is the unversioned prototype format
 * ({ volume, unlocked }) kept here as the template for future migrations.
 */
const MIGRATIONS: Record<number, (old: Json) => Json> = {
  0: (old) => ({
    saveVersion: 1,
    settings: { musicVolume: old.volume, sfxVolume: old.volume },
    progress: { unlockedFighters: old.unlocked },
  }),
  // v1 -> v2: every v1 win was an Arcade win, so it keeps counting for Arcade-based unlocks.
  1: (old) => {
    const progress = isObject(old.progress) ? old.progress : {};
    return { ...old, saveVersion: 2, progress: { ...progress, arcadeWins: progress.wins } };
  },
};

export const sanitizeSettings = (raw: unknown): Settings => {
  const s = isObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    musicVolume: num(s.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(s.sfxVolume, d.sfxVolume, 0, 1),
    uiVolume: num(s.uiVolume, d.uiVolume, 0, 1),
    muted: bool(s.muted, d.muted),
    quality: oneOf(s.quality, ['low', 'medium', 'high'], d.quality),
    particles: bool(s.particles, d.particles),
    screenShake: bool(s.screenShake, d.screenShake),
    reduceFlashes: bool(s.reduceFlashes, d.reduceFlashes),
    language: oneOf(s.language, ['pt-BR'], d.language),
    difficulty: oneOf(s.difficulty, ['easy', 'normal', 'hard'], d.difficulty),
    touchControls: oneOf(s.touchControls, ['auto', 'on', 'off'], d.touchControls),
    touchOpacity: num(s.touchOpacity, d.touchOpacity, 0.2, 1),
  };
};

export const sanitizeControls = (raw: unknown): ControlBindings => {
  const c = isObject(raw) ? raw : {};
  const out = cloneControls(DEFAULT_CONTROLS);
  for (const action of ALL_ACTIONS) {
    const codes = c[action];
    if (
      Array.isArray(codes) &&
      codes.length > 0 &&
      codes.every((k) => typeof k === 'string' && k.length > 0)
    ) {
      out[action] = [...(codes as string[])];
    }
  }
  return out;
};

const sanitizeLadder = (raw: unknown): LadderState | null => {
  if (!isObject(raw) || typeof raw.fighterId !== 'string' || !Array.isArray(raw.stages)) return null;
  const stages = raw.stages.filter(
    (s): s is LadderStage =>
      isObject(s) &&
      typeof s.opponentId === 'string' &&
      typeof s.arenaId === 'string' &&
      typeof s.shadow === 'boolean',
  );
  if (stages.length === 0) return null;
  return { fighterId: raw.fighterId, stage: num(raw.stage, 0, 0, stages.length - 1), stages };
};

const strings = (v: unknown, allowed?: Set<string>): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed.has(x))))]
    : [];

const sanitizeMastery = (raw: unknown, known: Set<string>): Record<string, MasteryData> => {
  const out: Record<string, MasteryData> = {};
  if (!isObject(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!known.has(id) || !isObject(v)) continue;
    out[id] = { xp: num(v.xp, 0, 0), spec: typeof v.spec === 'string' ? v.spec : null };
  }
  return out;
};

const sanitizeAchievements = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [id, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[id] = v;
  return out;
};

const sanitizeRewards = (raw: unknown): RewardLogEntry[] =>
  Array.isArray(raw)
    ? raw
        .filter((r): r is Json => isObject(r) && typeof r.key === 'string')
        .slice(-RECENT_REWARDS)
        .map((r) => ({
          key: r.key as string,
          params: isObject(r.params)
            ? (Object.fromEntries(
                Object.entries(r.params).filter(([, v]) => typeof v === 'string' || typeof v === 'number'),
              ) as Record<string, string | number>)
            : {},
          at: num(r.at, 0, 0),
        }))
    : [];

export const sanitizeSave = (raw: Json): SaveData => {
  const base = createDefaultSave();
  const p = isObject(raw.progress) ? raw.progress : {};
  const st = isObject(raw.stats) ? raw.stats : {};
  const known = new Set(FIGHTERS.map((f) => f.id));
  const unlocked = Array.isArray(p.unlockedFighters)
    ? p.unlockedFighters.filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  const perFighter: StatsData['perFighter'] = {};
  if (isObject(st.perFighter)) {
    for (const [id, v] of Object.entries(st.perFighter)) {
      if (isObject(v)) perFighter[id] = { wins: num(v.wins, 0, 0), losses: num(v.losses, 0, 0) };
    }
  }
  return {
    saveVersion: SAVE_VERSION,
    settings: sanitizeSettings(raw.settings),
    controls: sanitizeControls(raw.controls),
    progress: {
      xp: num(p.xp, 0, 0),
      wins: num(p.wins, 0, 0),
      losses: num(p.losses, 0, 0),
      laddersCleared: num(p.laddersCleared, 0, 0),
      laddersStarted: num(p.laddersStarted, 0, 0),
      unlockedFighters: [...new Set([...base.progress.unlockedFighters, ...unlocked])],
      ladder: sanitizeLadder(p.ladder),
      arcadeWins: num(p.arcadeWins, 0, 0),
      arcadeStreak: num(p.arcadeStreak, 0, 0),
      bestArcadeStreak: num(p.bestArcadeStreak, 0, 0),
      flawlessWins: num(p.flawlessWins, 0, 0),
      perfectDodges: num(p.perfectDodges, 0, 0),
      shadowWins: num(p.shadowWins, 0, 0),
      tournamentsWon: num(p.tournamentsWon, 0, 0),
      tournamentEditions: num(p.tournamentEditions, 0, 0),
      winningFighters: strings(p.winningFighters, known),
      winningArenas: strings(p.winningArenas),
      claimedMatches: strings(p.claimedMatches).slice(-CLAIMED_MATCH_MEMORY),
      achievements: sanitizeAchievements(p.achievements),
      mastery: sanitizeMastery(p.mastery, known),
      titles: strings(p.titles),
      activeTitle: typeof p.activeTitle === 'string' ? p.activeTitle : null,
      recentRewards: sanitizeRewards(p.recentRewards),
    },
    stats: {
      matches: num(st.matches, 0, 0),
      damageDealt: num(st.damageDealt, 0, 0),
      damageTaken: num(st.damageTaken, 0, 0),
      bestCombo: num(st.bestCombo, 0, 0),
      skillsUsed: num(st.skillsUsed, 0, 0),
      ultimatesUsed: num(st.ultimatesUsed, 0, 0),
      playSeconds: num(st.playSeconds, 0, 0),
      blocks: num(st.blocks, 0, 0),
      counters: num(st.counters, 0, 0),
      perFighter,
    },
    tournament: sanitizeTournament(raw.tournament, known),
  };
};

/** Runs migrations up to the current version. Returns null for saves from a newer game version. */
export const migrateSave = (raw: Json): { data: Json; migrated: boolean } | null => {
  let version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 0;
  if (version > SAVE_VERSION) return null;
  let data = raw;
  let migrated = false;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version++;
    migrated = true;
  }
  return { data, migrated };
};

/**
 * Versioned local save. Never throws: invalid or unavailable storage falls back to defaults,
 * and corrupt data is backed up instead of being silently discarded.
 */
export class SaveManager {
  private current: SaveData = createDefaultSave();
  lastIssue: LoadIssue = 'none';

  constructor(
    private readonly storage: StorageLike | null,
    private readonly key: string = SAVE_KEY,
  ) {}

  get data(): SaveData {
    return this.current;
  }

  load(): SaveData {
    const raw = this.read(this.key);
    if (raw === null) {
      this.lastIssue = 'empty';
      this.current = createDefaultSave();
      return this.current;
    }
    try {
      const result = this.parse(raw);
      if (result === 'future') {
        Logger.warn('Save', 'Save is from a newer version; using defaults without overwriting it.');
        this.lastIssue = 'future_version';
        this.current = createDefaultSave();
        return this.current;
      }
      this.current = result.data;
      this.lastIssue = result.migrated ? 'migrated' : 'none';
      if (result.migrated) this.persist();
    } catch (err) {
      Logger.warn('Save', 'Corrupt save, backing it up and trying the last good copy.', err);
      this.backup(raw);
      const previous = this.read(this.mirrorKey);
      const recovered = previous ? this.tryParse(previous) : null;
      this.current = recovered ?? createDefaultSave();
      this.lastIssue = recovered ? 'recovered' : 'corrupt';
      this.persist();
    }
    return this.current;
  }

  private get mirrorKey(): string {
    return `${this.key}-last-good`;
  }

  private parse(raw: string): { data: SaveData; migrated: boolean } | 'future' {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error('save root is not an object');
    const migrated = migrateSave(parsed);
    if (!migrated) return 'future';
    return { data: sanitizeSave(migrated.data), migrated: migrated.migrated };
  }

  private tryParse(raw: string): SaveData | null {
    try {
      const r = this.parse(raw);
      return r === 'future' ? null : r.data;
    } catch {
      return null;
    }
  }

  update(mutator: (data: SaveData) => void): boolean {
    mutator(this.current);
    return this.persist();
  }

  reset(): void {
    this.current = createDefaultSave();
    this.persist();
  }

  /**
   * Writes the save, then mirrors it to a "last good" copy used to recover from corruption.
   * A failed write keeps the data in memory; the next update retries.
   */
  persist(): boolean {
    if (this.lastIssue === 'future_version') return false;
    try {
      const json = JSON.stringify(this.current);
      this.storage?.setItem(this.key, json);
      this.storage?.setItem(this.mirrorKey, json);
      this.pendingWrite = false;
      return this.storage !== null;
    } catch (err) {
      this.pendingWrite = true;
      Logger.warn('Save', 'Could not write save (storage full or blocked). Will retry.', err);
      return false;
    }
  }

  /** True when the last write failed and the in-memory progress is newer than storage. */
  pendingWrite = false;

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch (err) {
      Logger.warn('Save', 'Storage unavailable.', err);
      return null;
    }
  }

  private backup(raw: string): void {
    try {
      this.storage?.setItem(`${this.key}-corrupt-backup`, raw);
    } catch {
      // Ignore: the backup is best effort only.
    }
  }
}

/** Returns window.localStorage when available, null otherwise (private mode, sandboxed iframes). */
export const browserStorage = (): StorageLike | null => {
  try {
    const s = globalThis.localStorage;
    const probe = '__lf_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
};
