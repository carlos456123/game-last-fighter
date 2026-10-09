import type { FighterMatchStats } from '@/core/Match';
import type { ArenaData, FighterData } from '@/types';
import type { LadderStage, SaveData } from './SaveManager';

export const XP = {
  win: 100,
  perStage: 50,
  perfect: 100,
  comboBonusThreshold: 5,
  comboBonus: 25,
  fastWinSeconds: 60,
  fastBonus: 30,
  loss: 20,
  ladderClear: 250,
} as const;

/** Cumulative XP needed to reach a level (level 1 = 0 XP). */
export const xpForLevel = (level: number): number => (level <= 1 ? 0 : 150 * (level - 1) * level);

export const levelForXp = (xp: number): number => {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
};

export interface Reward {
  xp: number;
  bonuses: Array<{ key: string; xp: number }>;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
  ladderComplete: boolean;
}

export interface MatchResult {
  won: boolean;
  fighterId: string;
  stats: FighterMatchStats;
  durationSeconds: number;
}

/**
 * Builds the arcade ladder: every other fighter in roster order, then the player's own
 * shadow as the final boss. Arenas rotate so the run shows every stage.
 */
export const buildLadder = (
  fighterId: string,
  roster: readonly FighterData[],
  arenas: readonly ArenaData[],
): LadderStage[] => {
  const others = roster.filter((f) => f.id !== fighterId);
  const stages: LadderStage[] = others.map((f, i) => ({
    opponentId: f.id,
    arenaId: arenas[i % arenas.length].id,
    shadow: false,
  }));
  stages.push({ opponentId: fighterId, arenaId: arenas[0].id, shadow: true });
  return stages;
};

export const isUnlocked = (save: SaveData, fighter: FighterData): boolean =>
  fighter.unlock.type === 'default' || save.progress.unlockedFighters.includes(fighter.id);

export const unlockProgress = (
  save: SaveData,
  fighter: FighterData,
): { current: number; required: number } => {
  if (fighter.unlock.type === 'default') return { current: 0, required: 0 };
  return { current: Math.min(save.progress.wins, fighter.unlock.count), required: fighter.unlock.count };
};

export class ProgressionManager {
  constructor(
    private readonly roster: readonly FighterData[],
    private readonly arenas: readonly ArenaData[],
  ) {}

  startLadder(save: SaveData, fighterId: string): void {
    save.progress.ladder = { fighterId, stage: 0, stages: buildLadder(fighterId, this.roster, this.arenas) };
  }

  currentStage(save: SaveData): LadderStage | null {
    const ladder = save.progress.ladder;
    return ladder ? (ladder.stages[ladder.stage] ?? null) : null;
  }

  /** Applies the result of a ladder match to the save and returns what was earned. */
  recordResult(save: SaveData, result: MatchResult): Reward {
    const p = save.progress;
    const levelBefore = levelForXp(p.xp);
    const bonuses: Reward['bonuses'] = [];
    let ladderComplete = false;

    const stats = save.stats;
    stats.matches++;
    stats.damageDealt += result.stats.damageDealt;
    stats.damageTaken += result.stats.damageTaken;
    stats.bestCombo = Math.max(stats.bestCombo, result.stats.maxCombo);
    stats.skillsUsed += result.stats.skillsUsed;
    stats.ultimatesUsed += result.stats.ultimatesUsed;
    stats.playSeconds += result.durationSeconds;
    const per = (stats.perFighter[result.fighterId] ??= { wins: 0, losses: 0 });

    if (result.won) {
      p.wins++;
      per.wins++;
      const stage = p.ladder?.stage ?? 0;
      bonuses.push({ key: 'rewards.win', xp: XP.win });
      if (stage > 0) bonuses.push({ key: 'rewards.stage', xp: XP.perStage * stage });
      if (result.stats.damageTaken === 0) bonuses.push({ key: 'rewards.perfect', xp: XP.perfect });
      if (result.stats.maxCombo >= XP.comboBonusThreshold)
        bonuses.push({ key: 'rewards.combo', xp: XP.comboBonus });
      if (result.durationSeconds <= XP.fastWinSeconds)
        bonuses.push({ key: 'rewards.fast', xp: XP.fastBonus });
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
      p.losses++;
      per.losses++;
      bonuses.push({ key: 'rewards.effort', xp: XP.loss });
    }

    const xp = bonuses.reduce((acc, b) => acc + b.xp, 0);
    p.xp += xp;
    const unlocked = this.checkUnlocks(save);
    return { xp, bonuses, levelBefore, levelAfter: levelForXp(p.xp), unlocked, ladderComplete };
  }

  /** Unlocks every fighter whose rule is now satisfied. Returns the newly unlocked ids. */
  checkUnlocks(save: SaveData): string[] {
    const newly: string[] = [];
    for (const f of this.roster) {
      if (f.unlock.type !== 'wins' || save.progress.unlockedFighters.includes(f.id)) continue;
      if (save.progress.wins >= f.unlock.count) {
        save.progress.unlockedFighters.push(f.id);
        newly.push(f.id);
      }
    }
    return newly;
  }
}
