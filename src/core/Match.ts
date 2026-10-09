import { COMBAT, FPS, MATCH } from '@/config/gameConfig';
import { Character, type CharacterHooks, type Side, type WorldBounds } from '@/characters/Character';
import { CombatSystem } from '@/combat/CombatSystem';
import { createInputFrame } from '@/input/InputFrame';
import type { ArenaData, FighterData, InputFrame } from '@/types';
import { EventBus } from './EventBus';
import type { MatchEvents, RoundEndReason } from './MatchEvents';

export type MatchPhase = 'countdown' | 'fight' | 'ko' | 'matchEnd';
export type MatchMode = 'versus' | 'training';

export interface MatchOptions {
  p1: FighterData;
  p2: FighterData;
  arena: ArenaData;
  mode?: MatchMode;
  roundsToWin?: number;
  roundTimeSeconds?: number;
}

export interface FighterMatchStats {
  damageDealt: number;
  damageTaken: number;
  maxCombo: number;
  hitsLanded: number;
  skillsUsed: number;
  ultimatesUsed: number;
  blocks: number;
  perfectDodges: number;
}

const emptyStats = (): FighterMatchStats => ({
  damageDealt: 0,
  damageTaken: 0,
  maxCombo: 0,
  hitsLanded: 0,
  skillsUsed: 0,
  ultimatesUsed: 0,
  blocks: 0,
  perfectDodges: 0,
});

const TRAINING_REGEN_DELAY = 90;
const VICTORY_POSE_DELAY = 50;

/**
 * A complete 1v1 match: rounds, countdown, timer, KO/time-out rules, hitstop and the ultimate
 * "super freeze". Pure logic: the BattleScene only feeds inputs and renders the result.
 */
export class Match {
  readonly events = new EventBus<MatchEvents>();
  readonly combat: CombatSystem;
  readonly fighters: [Character, Character];
  readonly arena: ArenaData;
  readonly bounds: WorldBounds;
  readonly mode: MatchMode;
  readonly roundsToWin: number;
  readonly roundFrames: number;
  readonly stats: Record<Side, FighterMatchStats> = { p1: emptyStats(), p2: emptyStats() };

  /** Counts every call to step(). */
  frame = 0;
  /** Simulation clock: only advances on unfrozen ticks (used for buffers and frame data). */
  simFrame = 0;
  phase: MatchPhase = 'countdown';
  phaseFrame = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  timerFrames: number;
  hitstop = 0;
  superFreeze = 0;
  superFreezeOwner: Side | null = null;
  fightFrames = 0;
  roundWinner: Side | null = null;
  roundReason: RoundEndReason | null = null;
  matchWinner: Side | null = null;
  /** Training: skills never run out of energy. */
  infiniteEnergy = false;
  private lastHitFrame: Record<Side, number> = { p1: 0, p2: 0 };
  private readonly empty = createInputFrame();

  constructor(options: MatchOptions) {
    this.arena = options.arena;
    this.mode = options.mode ?? 'versus';
    this.roundsToWin = options.roundsToWin ?? MATCH.roundsToWin;
    this.roundFrames = (options.roundTimeSeconds ?? MATCH.roundTimeSeconds) * FPS;
    this.timerFrames = this.roundFrames;
    this.bounds = { left: options.arena.bounds.left, right: options.arena.bounds.right };
    this.combat = new CombatSystem(this.events);
    const hooks = this.createHooks();
    this.fighters = [new Character(options.p1, 'p1', hooks), new Character(options.p2, 'p2', hooks)];
    if (this.mode === 'training') for (const f of this.fighters) f.koProtected = true;
    this.trackStats();
    this.startRound();
  }

  get p1(): Character {
    return this.fighters[0];
  }

  get p2(): Character {
    return this.fighters[1];
  }

  fighter(side: Side): Character {
    return side === 'p1' ? this.fighters[0] : this.fighters[1];
  }

  opponentOf(side: Side): Character {
    return side === 'p1' ? this.fighters[1] : this.fighters[0];
  }

  get secondsLeft(): number {
    return Math.ceil(this.timerFrames / FPS);
  }

  get isOver(): boolean {
    return this.phase === 'matchEnd';
  }

  private createHooks(): CharacterHooks {
    const ev = this.events;
    return {
      onMoveStart: (f, move) => {
        ev.emit('moveStart', { fighter: f.side, move });
        if (move.cinematicFreeze) {
          this.superFreeze = move.cinematicFreeze;
          this.superFreezeOwner = f.side;
          ev.emit('ultimateStart', { fighter: f.side, moveId: move.id, freeze: move.cinematicFreeze });
        }
      },
      onProjectile: (f, move) => this.combat.spawnProjectile(f, move),
      onDenied: (f, move, reason) => ev.emit('denied', { fighter: f.side, moveId: move.id, reason }),
      onJump: (f) => ev.emit('jump', { fighter: f.side }),
      onLand: (f) => ev.emit('land', { fighter: f.side }),
      onDodge: (f) => ev.emit('dodge', { fighter: f.side }),
      onTeleport: (f, fromX) => ev.emit('teleport', { fighter: f.side, fromX, toX: f.x, y: f.y }),
      onStun: (f) => ev.emit('stun', { fighter: f.side }),
      onKnockdown: (f) => ev.emit('knockdown', { fighter: f.side }),
      onWhiff: (f, move) => ev.emit('whiff', { fighter: f.side, moveId: move.id }),
    };
  }

  private trackStats(): void {
    this.events.on('hit', (e) => {
      this.stats[e.attacker].damageDealt += e.damage;
      this.stats[e.attacker].hitsLanded++;
      this.stats[e.defender].damageTaken += e.damage;
      this.stats[e.attacker].maxCombo = Math.max(this.stats[e.attacker].maxCombo, e.combo);
      this.lastHitFrame[e.defender] = this.frame;
    });
    this.events.on('block', (e) => this.stats[e.defender].blocks++);
    this.events.on('perfectDodge', (e) => this.stats[e.fighter].perfectDodges++);
    this.events.on('moveStart', (e) => {
      if (e.move.kind === 'special') this.stats[e.fighter].skillsUsed++;
      if (e.move.kind === 'ultimate') this.stats[e.fighter].ultimatesUsed++;
    });
  }

  private startRound(): void {
    const { p1, p2 } = this.arena.spawn;
    this.combat.reset();
    this.fighters[0].resetForRound(p1, 1, COMBAT.energyRoundStart);
    this.fighters[1].resetForRound(p2, -1, COMBAT.energyRoundStart);
    this.timerFrames = this.roundFrames;
    this.hitstop = 0;
    this.superFreeze = 0;
    this.superFreezeOwner = null;
    this.roundWinner = null;
    this.roundReason = null;
    this.phase = this.mode === 'training' ? 'fight' : 'countdown';
    this.phaseFrame = 0;
    this.events.emit('roundStart', { round: this.round });
    if (this.mode === 'training') this.events.emit('fight', { round: this.round });
  }

  /** Advances the simulation by exactly one 60 Hz frame. */
  step(p1Input: InputFrame, p2Input: InputFrame): void {
    this.frame++;
    const live = this.phase === 'fight';
    this.fighters[0].receiveInput(this.simFrame, live ? p1Input : this.empty);
    this.fighters[1].receiveInput(this.simFrame, live ? p2Input : this.empty);
    if (this.phase === 'matchEnd') {
      this.simFrame++;
      this.updateFighters();
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    if (this.superFreeze > 0) {
      this.superFreeze--;
      if (this.superFreeze === 0) this.superFreezeOwner = null;
      return;
    }

    this.simFrame++;
    this.updateFighters();
    this.hitstop = Math.max(this.hitstop, this.combat.step(this.fighters, this.bounds));

    switch (this.phase) {
      case 'countdown':
        this.stepCountdown();
        break;
      case 'fight':
        this.stepFight();
        break;
      case 'ko':
        this.stepKo();
        break;
      default:
        break;
    }
  }

  private updateFighters(): void {
    const [a, b] = this.fighters;
    a.update(this.simFrame, b, this.bounds);
    b.update(this.simFrame, a, this.bounds);
  }

  private stepCountdown(): void {
    const step = MATCH.countdownStepFrames;
    if (this.phaseFrame % step === 0 && this.phaseFrame < step * 3) {
      this.events.emit('countdown', { value: 3 - this.phaseFrame / step });
    }
    this.phaseFrame++;
    if (this.phaseFrame >= step * 3) {
      this.phase = 'fight';
      this.phaseFrame = 0;
      this.events.emit('fight', { round: this.round });
    }
  }

  private stepFight(): void {
    this.phaseFrame++;
    this.fightFrames++;
    if (this.mode === 'training') {
      this.stepTraining();
      return;
    }
    const [a, b] = this.fighters;
    if (a.isKO || b.isKO) {
      const reason: RoundEndReason = a.isKO && b.isKO ? 'double_ko' : 'ko';
      const winner: Side | null = reason === 'double_ko' ? null : a.isKO ? 'p2' : 'p1';
      this.endRound(winner, reason);
      this.hitstop = MATCH.koHitstop;
      return;
    }
    this.timerFrames--;
    if (this.timerFrames <= 0) {
      this.timerFrames = 0;
      const ra = a.health / a.maxHealth;
      const rb = b.health / b.maxHealth;
      const winner: Side | null = ra === rb ? null : ra > rb ? 'p1' : 'p2';
      this.endRound(winner, 'time');
      if (winner) this.fighter(winner === 'p1' ? 'p2' : 'p1').setDefeat();
    }
  }

  private stepTraining(): void {
    for (const f of this.fighters) {
      if (this.infiniteEnergy) f.skills.energy = f.skills.maxEnergy;
      const idle = this.frame - this.lastHitFrame[f.side] > TRAINING_REGEN_DELAY;
      if (idle && !f.isVulnerable && f.health < f.maxHealth) f.health = f.maxHealth;
    }
  }

  private endRound(winner: Side | null, reason: RoundEndReason): void {
    this.phase = 'ko';
    this.phaseFrame = 0;
    this.roundWinner = winner;
    this.roundReason = reason;
    if (winner) this.wins[winner === 'p1' ? 0 : 1]++;
    this.events.emit('ko', { winner, reason });
  }

  private stepKo(): void {
    this.phaseFrame++;
    if (this.roundWinner && this.phaseFrame === VICTORY_POSE_DELAY) {
      const w = this.fighter(this.roundWinner);
      if (!w.airborne) w.setVictory();
    } else if (this.roundWinner && this.phaseFrame > VICTORY_POSE_DELAY) {
      const w = this.fighter(this.roundWinner);
      if (w.state !== 'VICTORY' && !w.airborne) w.setVictory();
    }
    if (this.phaseFrame < MATCH.roundEndFrames) return;

    const reason = this.roundReason ?? 'ko';
    this.events.emit('roundEnd', { winner: this.roundWinner, reason, wins: [...this.wins] });
    const decided = this.wins[0] >= this.roundsToWin || this.wins[1] >= this.roundsToWin;
    if (decided || this.round >= MATCH.maxRounds) {
      this.phase = 'matchEnd';
      this.phaseFrame = 0;
      this.matchWinner = this.wins[0] === this.wins[1] ? null : this.wins[0] > this.wins[1] ? 'p1' : 'p2';
      this.events.emit('matchEnd', { winner: this.matchWinner });
      return;
    }
    this.round++;
    this.startRound();
  }
}
