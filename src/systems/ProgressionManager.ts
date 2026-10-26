import type { FighterMatchStats } from '@/core/Match';
import { ACHIEVEMENTS } from '@/data/progression/achievements';
import { MASTERY, getSpec, masteryLevel, specsFor } from '@/data/progression/specializations';
import type { SpecTier } from '@/characters/Specialization';
import type { ArenaData, FighterData, UnlockRule } from '@/types';
import { Rng } from '@/utils/MathUtils';
import { SAVE_LIMITS, type LadderStage, type SaveData } from './SaveManager';

/** All XP values in one place. */
export const XP = {
  win: 100,
  perStage: 30,
  perTournamentRound: 80,
  perfect: 100,
  comboBonusThreshold: 5,
  comboBonus: 25,
  fastWinSeconds: 60,
  fastBonus: 30,
  flawless: 40,
  loss: 20,
  ladderClear: 250,
  shadowDefeat: 150,
  tournamentChampion: 500,
} as const;

export const PLAYER_LEVEL = { base: 100, max: 30 } as const;
export const ARCADE = { opponents: 5 } as const;

/** Cumulative XP needed to reach a level (level 1 = 0 XP). Level 5 = 2000 XP. */
export const xpForLevel = (level: number): number =>
  level <= 1 ? 0 : PLAYER_LEVEL.base * (level - 1) * level;

export const levelForXp = (xp: number): number => {
  let level = 1;
  while (level < PLAYER_LEVEL.max && xpForLevel(level + 1) <= xp) level++;
  return level;
};

/** Progress within the current level, for XP bars. */
export const levelProgress = (
  xp: number,
): { level: number; current: number; needed: number; ratio: number } => {
  const level = levelForXp(xp);
  if (level >= PLAYER_LEVEL.max) return { level, current: 1, needed: 1, ratio: 1 };
  const base = xpForLevel(level);
  const needed = xpForLevel(level + 1) - base;
  return { level, current: xp - base, needed, ratio: (xp - base) / needed };
};

export type MatchMode = 'arcade' | 'tournament';

/** Everything the progression needs to know about a finished, valid match. */
export interface MatchRecord {
  matchId: string;
  mode: MatchMode;
  won: boolean;
  fighterId: string;
  arenaId: string;
  stats: FighterMatchStats;
  roundsLost: number;
  durationSeconds: number;
  /** Arcade boss (Reflexo). */
  shadow: boolean;
  /** Arcade stage index or tournament round index (0 = quarterfinal). */
  stage: number;
  /** The tournament manager confirmed this result made the player champion. */
  tournamentChampion: boolean;
}

export interface Reward {
  /** True when the match had already been rewarded (no XP granted). */
  duplicate: boolean;
  xp: number;
  bonuses: Array<{ key: string; xp: number }>;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
  achievements: string[];
  mastery: { fighterId: string; xp: number; levelBefore: number; levelAfter: number };
  ladderComplete: boolean;
  tournamentChampion: boolean;
}

// ------------------------------------------------------------------ unlock rules

export const ruleProgress = (save: SaveData, rule: UnlockRule): { current: number; required: number } => {
  const p = save.progress;
  switch (rule.type) {
    case 'default':
      return { current: 0, required: 0 };
    case 'wins':
      return { current: Math.min(p.arcadeWins, rule.count), required: rule.count };
    case 'perfectDodges':
      return { current: Math.min(p.perfectDodges, rule.count), required: rule.count };
    case 'flawlessWins':
      return { current: Math.min(p.flawlessWins, rule.count), required: rule.count };
    case 'playerLevel':
      return { current: Math.min(levelForXp(p.xp), rule.level), required: rule.level };
    case 'arcadeStreak':
      return { current: Math.min(p.bestArcadeStreak, rule.count), required: rule.count };
    case 'defeatShadow':
      return { current: Math.min(p.shadowWins, 1), required: 1 };
    case 'tournamentWin':
      return { current: Math.min(p.tournamentsWon, 1), required: 1 };
  }
};

export const ruleMet = (save: SaveData, rule: UnlockRule): boolean => {
  if (rule.type === 'default') return true;
  const { current, required } = ruleProgress(save, rule);
  return current >= required;
};

export const isUnlocked = (save: SaveData, fighter: FighterData): boolean =>
  fighter.unlock.type === 'default' || save.progress.unlockedFighters.includes(fighter.id);

export const unlockProgress = (save: SaveData, fighter: FighterData): { current: number; required: number } =>
  ruleProgress(save, fighter.unlock);

// ------------------------------------------------------------------ mastery

export const masteryOf = (
  save: SaveData,
  fighterId: string,
): { xp: number; level: number; spec: string | null } => {
  const m = save.progress.mastery[fighterId] ?? { xp: 0, spec: null };
  return { xp: m.xp, level: masteryLevel(m.xp), spec: m.spec };
};

/** Specialization tier active for a fighter: 0 below Mastery II or without a choice. */
export const specTier = (save: SaveData, fighterId: string): SpecTier => {
  const m = masteryOf(save, fighterId);
  if (!m.spec || m.level < 2) return 0;
  return m.level >= MASTERY.maxLevel ? 2 : 1;
};

/** Sets the specialization. Only valid options for an unlocked fighter at Mastery II+ are accepted. */
export const chooseSpecialization = (save: SaveData, fighterId: string, specId: string): boolean => {
  const spec = getSpec(specId);
  if (!spec || spec.fighterId !== fighterId) return false;
  if (!save.progress.unlockedFighters.includes(fighterId)) return false;
  if (masteryOf(save, fighterId).level < 2) return false;
  if (!specsFor(fighterId).some((s) => s.id === specId)) return false;
  const entry = (save.progress.mastery[fighterId] ??= { xp: 0, spec: null });
  entry.spec = specId;
  return true;
};

// ------------------------------------------------------------------ arcade ladder

/**
 * Arcade ladder: five opponents chosen from the rest of the roster (rotating between runs so the
 * whole cast appears over time), then the player's own shadow as the final boss.
 */
export const buildLadder = (
  fighterId: string,
  roster: readonly FighterData[],
  arenas: readonly ArenaData[],
  run = 0,
): LadderStage[] => {
  const others = roster.filter((f) => f.id !== fighterId).map((f) => f.id);
  const rng = new Rng(1000 + run * 31 + others.length);
  const pool = [...others];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const opponents = pool.slice(0, Math.min(ARCADE.opponents, pool.length));
  const stages: LadderStage[] = opponents.map((id, i) => ({
    opponentId: id,
    arenaId: arenas[(i + run) % arenas.length].id,
    shadow: false,
  }));
  stages.push({ opponentId: fighterId, arenaId: arenas[arenas.length - 1].id, shadow: true });
  return stages;
};

// ------------------------------------------------------------------ manager

export class ProgressionManager {
  constructor(
    private readonly roster: readonly FighterData[],
    private readonly arenas: readonly ArenaData[],
  ) {}

  startLadder(save: SaveData, fighterId: string): void {
    save.progress.ladder = {
      fighterId,
      stage: 0,
      stages: buildLadder(fighterId, this.roster, this.arenas, save.progress.laddersStarted),
    };
    save.progress.laddersStarted++;
  }

  currentStage(save: SaveData): LadderStage | null {
    const ladder = save.progress.ladder;
    return ladder ? (ladder.stages[ladder.stage] ?? null) : null;
  }

  /**
   * Applies a finished, valid match to the save exactly once (by match id) and returns what was
   * earned. Training matches and abandoned matches must never be recorded.
   */
  recordMatch(save: SaveData, rec: MatchRecord): Reward {
    const p = save.progress;
    const levelBefore = levelForXp(p.xp);
    const masteryBefore = masteryOf(save, rec.fighterId);
    const empty: Reward = {
      duplicate: true,
      xp: 0,
      bonuses: [],
      levelBefore,
      levelAfter: levelBefore,
      unlocked: [],
      achievements: [],
      mastery: {
        fighterId: rec.fighterId,
        xp: 0,
        levelBefore: masteryBefore.level,
        levelAfter: masteryBefore.level,
      },
      ladderComplete: false,
      tournamentChampion: false,
    };
    if (!rec.matchId || p.claimedMatches.includes(rec.matchId)) return empty;
    p.claimedMatches.push(rec.matchId);
    if (p.claimedMatches.length > SAVE_LIMITS.claimedMatches)
      p.claimedMatches.splice(0, p.claimedMatches.length - SAVE_LIMITS.claimedMatches);

    this.recordStats(save, rec);
    const bonuses: Reward['bonuses'] = [];
    let ladderComplete = false;
    const per = (save.stats.perFighter[rec.fighterId] ??= { wins: 0, losses: 0 });

    if (rec.won) {
      p.wins++;
      per.wins++;
      if (!p.winningFighters.includes(rec.fighterId)) p.winningFighters.push(rec.fighterId);
      if (!p.winningArenas.includes(rec.arenaId)) p.winningArenas.push(rec.arenaId);
      if (rec.roundsLost === 0) p.flawlessWins++;
      bonuses.push({ key: 'rewards.win', xp: XP.win });
      if (rec.mode === 'arcade') {
        p.arcadeWins++;
        p.arcadeStreak++;
        p.bestArcadeStreak = Math.max(p.bestArcadeStreak, p.arcadeStreak);
        if (rec.stage > 0) bonuses.push({ key: 'rewards.stage', xp: XP.perStage * rec.stage });
        if (rec.shadow) {
          p.shadowWins++;
          bonuses.push({ key: 'rewards.shadow', xp: XP.shadowDefeat });
        }
        if (p.ladder) {
          if (p.ladder.stage >= p.ladder.stages.length - 1) {
            ladderComplete = true;
            p.laddersCleared++;
            bonuses.push({ key: 'rewards.ladder', xp: XP.ladderClear });
            p.ladder = null;
          } else {
            p.ladder.stage++;
          }
        }
      } else {
        bonuses.push({ key: 'rewards.tournamentRound', xp: XP.perTournamentRound * (rec.stage + 1) });
        if (rec.tournamentChampion) {
          p.tournamentsWon++;
          bonuses.push({ key: 'rewards.tournamentChampion', xp: XP.tournamentChampion });
        }
      }
      if (rec.stats.damageTaken === 0) bonuses.push({ key: 'rewards.perfect', xp: XP.perfect });
      if (rec.roundsLost === 0) bonuses.push({ key: 'rewards.flawless', xp: XP.flawless });
      if (rec.stats.maxCombo >= XP.comboBonusThreshold)
        bonuses.push({ key: 'rewards.combo', xp: XP.comboBonus });
      if (rec.durationSeconds <= XP.fastWinSeconds) bonuses.push({ key: 'rewards.fast', xp: XP.fastBonus });
    } else {
      p.losses++;
      per.losses++;
      if (rec.mode === 'arcade') p.arcadeStreak = 0;
      bonuses.push({ key: 'rewards.effort', xp: XP.loss });
    }

    // Fighter mastery.
    const masteryGain = rec.won
      ? rec.mode === 'tournament'
        ? MASTERY.tournamentWinXp
        : MASTERY.winXp
      : MASTERY.lossXp;
    const mastery = (p.mastery[rec.fighterId] ??= { xp: 0, spec: null });
    mastery.xp += masteryGain;

    const xp = bonuses.reduce((acc, b) => acc + b.xp, 0);
    p.xp += xp;
    const { unlocked, achievements, achievementXp } = this.settle(save);
    const masteryAfter = masteryOf(save, rec.fighterId);
    const now = Date.now();
    const log = (key: string, params: Record<string, string | number>): void => {
      p.recentRewards.push({ key, params, at: now });
    };
    log('log.match', { xp: xp + achievementXp, fighter: rec.fighterId });
    for (const id of unlocked) log('log.unlock', { fighter: id });
    for (const id of achievements) log('log.achievement', { id });
    if (masteryAfter.level > masteryBefore.level)
      log('log.mastery', { fighter: rec.fighterId, level: masteryAfter.level });
    if (p.recentRewards.length > SAVE_LIMITS.recentRewards)
      p.recentRewards.splice(0, p.recentRewards.length - SAVE_LIMITS.recentRewards);

    return {
      duplicate: false,
      xp: xp + achievementXp,
      bonuses: [
        ...bonuses,
        ...achievements.map((id) => ({
          key: `achievements.${id}.name`,
          xp: ACHIEVEMENTS.find((a) => a.id === id)?.xp ?? 0,
        })),
      ],
      levelBefore,
      levelAfter: levelForXp(p.xp),
      unlocked,
      achievements,
      mastery: {
        fighterId: rec.fighterId,
        xp: masteryGain,
        levelBefore: masteryBefore.level,
        levelAfter: masteryAfter.level,
      },
      ladderComplete,
      tournamentChampion: rec.mode === 'tournament' && rec.tournamentChampion,
    };
  }

  private recordStats(save: SaveData, rec: MatchRecord): void {
    const st = save.stats;
    st.matches++;
    st.damageDealt += rec.stats.damageDealt;
    st.damageTaken += rec.stats.damageTaken;
    st.bestCombo = Math.max(st.bestCombo, rec.stats.maxCombo);
    st.skillsUsed += rec.stats.skillsUsed;
    st.ultimatesUsed += rec.stats.ultimatesUsed;
    st.playSeconds += rec.durationSeconds;
    st.blocks += rec.stats.blocks;
    st.counters += rec.stats.counters;
    save.progress.perfectDodges += rec.stats.perfectDodges;
  }

  /**
   * Repeats unlock and achievement checks until nothing changes (an achievement's XP can raise
   * the level, which can unlock a fighter, which can complete "Colecionador"...). Bounded.
   */
  settle(save: SaveData): { unlocked: string[]; achievements: string[]; achievementXp: number } {
    const unlocked: string[] = [];
    const achievements: string[] = [];
    let achievementXp = 0;
    for (let pass = 0; pass < 6; pass++) {
      const u = this.checkUnlocks(save);
      const a = this.checkAchievements(save);
      unlocked.push(...u);
      achievements.push(...a.ids);
      achievementXp += a.xp;
      if (u.length === 0 && a.ids.length === 0) break;
    }
    return { unlocked, achievements, achievementXp };
  }

  /** Unlocks every fighter whose rule is now satisfied. Returns the newly unlocked ids. */
  checkUnlocks(save: SaveData): string[] {
    const newly: string[] = [];
    for (const f of this.roster) {
      if (f.unlock.type === 'default' || save.progress.unlockedFighters.includes(f.id)) continue;
      if (ruleMet(save, f.unlock)) {
        save.progress.unlockedFighters.push(f.id);
        newly.push(f.id);
      }
    }
    return newly;
  }

  checkAchievements(save: SaveData): { ids: string[]; xp: number } {
    const ids: string[] = [];
    let xp = 0;
    for (const a of ACHIEVEMENTS) {
      if (save.progress.achievements[a.id] !== undefined) continue;
      if (a.progress(save) < a.target) continue;
      save.progress.achievements[a.id] = Date.now();
      if (a.title && !save.progress.titles.includes(a.title)) save.progress.titles.push(a.title);
      save.progress.xp += a.xp;
      xp += a.xp;
      ids.push(a.id);
    }
    return { ids, xp };
  }
}
