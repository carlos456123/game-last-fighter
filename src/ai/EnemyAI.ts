import type { Character } from '@/characters/Character';
import type { Projectile } from '@/combat/Projectile';
import { isCornered } from '@/combat/PushSystem';
import { createButtonState } from '@/input/InputFrame';
import type { BehaviorProfile, ButtonState, Difficulty, FightButton, InputFrame, MoveData } from '@/types';
import { Rng } from '@/utils/MathUtils';
import { AIState, type AIStateId } from './AIState';
import { combineProfile, type EffectiveProfile } from './BehaviorProfile';
import {
  chooseStrategy,
  classifyMoves,
  snapshotOf,
  type MoveRoles,
  type OpponentSnapshot,
  type Perception,
} from './DecisionSystem';
import { StateMachine, type MachineState } from './StateMachine';

export interface AIWorld {
  projectiles: readonly Projectile[];
  bounds: { left: number; right: number };
}

type ComboStep = { button: FightButton; down?: boolean };

const HISTORY = 40;

/**
 * Enemy AI. It never touches the simulation directly: each tick it produces an InputFrame,
 * exactly like a human player, so it follows the same rules (energy, cooldowns, frame data).
 */
export class EnemyAI {
  readonly profile: EffectiveProfile;
  private readonly roles: MoveRoles;
  private readonly machine: StateMachine<AIStateId, EnemyAI>;
  private readonly history: OpponentSnapshot[] = [];
  private held: ButtonState = createButtonState();
  private taps: FightButton[] = [];
  private combo: ComboStep[] = [];
  private comboIndex = 0;
  /** Set when a state hands a ready-made combo to ATTACK (e.g. a jump-in). */
  private comboPrepared = false;
  private lastMoveInstance = -1;
  private decisionTimer = 0;
  private chosenSkill: MoveData | null = null;
  private dodgeDir: 1 | -1 = 1;
  perception: Perception | null = null;
  /** Lets tests and the tutorial freeze the AI. */
  enabled = true;

  constructor(
    readonly self: Character,
    readonly opponent: Character,
    profile: BehaviorProfile,
    difficulty: Difficulty,
    private readonly world: AIWorld,
    readonly rng: Rng = new Rng(),
  ) {
    this.profile = combineProfile(profile, difficulty);
    this.roles = classifyMoves(self);
    this.machine = new StateMachine<AIStateId, EnemyAI>(this.buildStates(), AIState.IDLE, this);
  }

  get state(): AIStateId {
    return this.machine.current;
  }

  /** Produces the input for this tick. */
  think(): InputFrame {
    this.held = createButtonState();
    this.taps = [];
    this.history.push(snapshotOf(this.opponent));
    if (this.history.length > HISTORY) this.history.shift();
    if (!this.enabled) return this.output();

    this.perception = this.perceive();
    this.applyOverrides();
    this.machine.update();
    return this.output();
  }

  private output(): InputFrame {
    const pressed = createButtonState();
    for (const b of this.taps) {
      pressed[b] = true;
      this.held[b] = true;
    }
    return { held: this.held, pressed };
  }

  private delayed(): OpponentSnapshot {
    const delay = this.profile.difficulty.reactionFrames;
    const index = Math.max(0, this.history.length - 1 - delay);
    return this.history[index];
  }

  private perceive(): Perception {
    const opp = this.delayed();
    const s = this.self;
    const gap = Math.max(
      0,
      Math.abs(this.opponent.x - s.x) - (s.data.body.width + this.opponent.data.body.width) / 2,
    );
    let incoming: Projectile | null = null;
    let frames = Infinity;
    for (const p of this.world.projectiles) {
      if (p.owner === s.side) continue;
      const towards = Math.sign(s.x - p.x) === Math.sign(p.vx);
      if (!towards) continue;
      const f = Math.abs(s.x - p.x) / Math.max(1, Math.abs(p.vx) / 60);
      if (f < frames) {
        frames = f;
        incoming = p;
      }
    }
    return {
      gap,
      dir: this.opponent.x >= s.x ? 1 : -1,
      opp,
      selfHealth: s.health / s.maxHealth,
      energy: s.energy,
      cornered: isCornered(s, this.world.bounds),
      incomingProjectile: incoming,
      projectileFrames: frames,
    };
  }

  /** Situations that override strategy regardless of the current state. */
  private applyOverrides(): void {
    const s = this.self;
    const current = this.machine.current;
    if (s.state === 'DEFEAT' || s.state === 'VICTORY') {
      if (current !== AIState.DEFEATED) this.machine.change(AIState.DEFEATED);
      return;
    }
    // A new round started: wake up.
    if (current === AIState.DEFEATED) this.machine.change(AIState.IDLE);
    if (s.state === 'HIT' || s.state === 'STUN') {
      if (current !== AIState.STUNNED) this.machine.change(AIState.STUNNED);
      return;
    }
    if (s.state === 'KNOCKDOWN') {
      if (current !== AIState.RECOVER) this.machine.change(AIState.RECOVER);
      return;
    }
    const p = this.perception;
    if (!p || !s.isNeutral) return;
    const d = this.profile.difficulty;
    // React to an incoming projectile.
    if (
      p.incomingProjectile &&
      p.projectileFrames < 22 &&
      current !== AIState.DEFEND &&
      current !== AIState.DODGE
    ) {
      if (this.rng.chance(d.dodgeChance * (0.5 + this.profile.dodge))) {
        this.dodgeDir = p.dir;
        this.machine.change(AIState.DODGE);
      } else if (this.rng.chance(d.blockChance)) {
        this.machine.change(AIState.DEFEND);
      }
      return;
    }
    // Anti-air a jump-in.
    if (p.opp.airborne && p.gap < 200 && p.opp.vx * p.dir < 0 && current !== AIState.USE_SKILL) {
      if (this.rng.chance(d.antiAirChance * 0.15)) {
        const anti = this.roles.antiAir;
        if (anti && !s.skills.check(anti, false)) {
          this.chosenSkill = anti;
          this.machine.change(AIState.USE_SKILL);
        } else {
          this.machine.change(AIState.DEFEND);
        }
      }
    }
  }

  // ---------------------------------------------------------------- input helpers

  private hold(button: FightButton): void {
    this.held[button] = true;
  }

  private tap(button: FightButton): void {
    this.taps.push(button);
  }

  private holdTowards(dir: 1 | -1): void {
    this.hold(dir === 1 ? 'right' : 'left');
  }

  private moveTowards(): void {
    if (this.perception) this.holdTowards(this.perception.dir);
  }

  private moveAway(): void {
    if (this.perception) this.holdTowards(this.perception.dir === 1 ? -1 : 1);
  }

  private planCombo(): void {
    const p = this.perception;
    const combo = this.profile.combo;
    const steps: ComboStep[] = [];
    const lowStarter = this.rng.chance(0.3);
    if (p && p.gap > this.roles.lightReach && p.gap <= this.roles.heavyReach) {
      steps.push({ button: 'heavy', down: this.rng.chance(0.3) });
    } else {
      steps.push({ button: 'light', down: lowStarter });
      const lights = 1 + Math.round(combo * 3);
      for (let i = 1; i < lights; i++) steps.push({ button: 'light' });
      if (this.rng.chance(0.4 + combo * 0.4)) steps.push({ button: 'heavy' });
    }
    if (this.rng.chance(this.profile.skill * 0.6))
      steps.push({ button: this.rng.chance(0.5) ? 'skill' : 'special' });
    this.combo = steps;
    this.comboIndex = 0;
    this.lastMoveInstance = this.self.moveInstance;
  }

  // ---------------------------------------------------------------- states

  private buildStates(): Record<AIStateId, MachineState<AIStateId, EnemyAI>> {
    return {
      IDLE: {
        update: (_c, f) => (f > 20 ? AIState.OBSERVE : null),
      },
      OBSERVE: {
        enter: () => {
          this.decisionTimer = Math.round(
            this.profile.difficulty.decisionInterval * this.rng.range(0.6, 1.4),
          );
        },
        update: () => {
          const p = this.perception;
          if (!p) return null;
          // Small footsies while waiting.
          if (p.gap > this.profile.preferredRange) this.moveTowards();
          else if (p.gap < this.profile.preferredRange * 0.5 && this.rng.chance(0.4)) this.moveAway();
          if (--this.decisionTimer > 0) return null;
          const next = chooseStrategy(p, this.profile, this.roles, this.self, this.rng);
          if (next === AIState.USE_SKILL) this.chosenSkill = this.pickSkill(p);
          if (next === AIState.OBSERVE) {
            this.decisionTimer = this.profile.difficulty.decisionInterval;
            return null;
          }
          return next;
        },
      },
      APPROACH: {
        update: (_c, f) => {
          const p = this.perception;
          if (!p) return null;
          const jumpIn = this.rng.chance(this.profile.mobility * 0.012) && p.gap < 320 && p.gap > 140;
          if (jumpIn) {
            this.moveTowards();
            this.hold('up');
            this.combo = [{ button: this.rng.chance(0.5) ? 'heavy' : 'light' }];
            this.comboIndex = 0;
            this.comboPrepared = true;
            return AIState.ATTACK;
          }
          if (p.gap > 360 && this.profile.mobility > 0.4 && f % 30 === 0) {
            // Double tap forward to run.
            this.tap(p.dir === 1 ? 'right' : 'left');
          }
          this.moveTowards();
          if (p.gap <= this.roles.lightReach) return AIState.ATTACK;
          return f > 120 ? AIState.OBSERVE : null;
        },
      },
      RETREAT: {
        update: (_c, f) => {
          const p = this.perception;
          if (!p) return null;
          if (p.cornered) return AIState.OBSERVE;
          if (f === 0 && this.rng.chance(this.profile.mobility * 0.3)) {
            this.moveAway();
            this.hold('up');
            return null;
          }
          this.moveAway();
          return f > 30 + this.profile.retreat * 30 ? AIState.OBSERVE : null;
        },
      },
      ATTACK: {
        enter: () => {
          if (!this.comboPrepared) this.planCombo();
          this.comboPrepared = false;
          this.lastMoveInstance = this.self.moveInstance;
        },
        update: (_c, f) => {
          const s = this.self;
          const p = this.perception;
          if (!p) return null;
          if (this.comboIndex >= this.combo.length) {
            this.combo = [];
            return s.move ? null : AIState.OBSERVE;
          }
          const step = this.combo[this.comboIndex];
          if (this.comboIndex === 0) {
            if (p.gap > this.roles.heavyReach + 20 && !s.airborne && s.state !== 'JUMP') {
              this.moveTowards();
              return f > 50 ? AIState.OBSERVE : null;
            }
            if (step.down) this.hold('down');
            this.tap(step.button);
            this.lastMoveInstance = s.moveInstance;
            this.comboIndex++;
            return null;
          }
          // Wait until the previously pressed attack has actually started.
          if (s.moveInstance === this.lastMoveInstance) return f > 24 && !s.move ? AIState.OBSERVE : null;
          // Continue only after contact (hit confirm), like a human would.
          if (s.move && s.connected && s.movePhase !== 'startup') {
            if (this.rng.chance(this.profile.difficulty.comboDrop * 0.3)) {
              this.combo = [];
              return AIState.OBSERVE;
            }
            this.tap(step.button);
            this.lastMoveInstance = s.moveInstance;
            this.comboIndex++;
            return null;
          }
          if (!s.move) {
            this.combo = [];
            return this.rng.chance(this.profile.defense * 0.5) ? AIState.DEFEND : AIState.OBSERVE;
          }
          return f > 90 ? AIState.OBSERVE : null;
        },
      },
      DEFEND: {
        update: (_c, f) => {
          const p = this.perception;
          if (!p) return null;
          this.hold('block');
          if (p.opp.level === 'low' && this.rng.chance(0.85)) this.hold('down');
          const threat = p.opp.attacking || (p.incomingProjectile !== null && p.projectileFrames < 40);
          if (this.self.blockstun > 0) return null;
          if (!threat && f > 12) {
            const punish =
              p.gap < this.roles.heavyReach + 20 && this.rng.chance(this.profile.difficulty.punishChance);
            return punish ? AIState.ATTACK : AIState.OBSERVE;
          }
          return f > 70 ? AIState.OBSERVE : null;
        },
      },
      DODGE: {
        update: (_c, f) => {
          if (f === 0) {
            this.holdTowards(this.dodgeDir);
            this.tap('block');
            return null;
          }
          return this.self.state === 'DODGE' || f < 3 ? null : AIState.OBSERVE;
        },
      },
      CHASE: {
        update: (_c, f) => {
          const p = this.perception;
          if (!p) return null;
          if (f === 0 || f === 3) this.tap(p.dir === 1 ? 'right' : 'left');
          this.moveTowards();
          if (p.gap < this.roles.lightReach + 20) return p.opp.knockedDown ? AIState.OBSERVE : AIState.ATTACK;
          return f > 70 ? AIState.OBSERVE : null;
        },
      },
      STUNNED: {
        update: (_c, f) => {
          const s = this.self;
          if (s.state === 'STUN' && f % 4 === 0) this.tap('light');
          if (s.state === 'HIT' || s.state === 'STUN') return null;
          return AIState.RECOVER;
        },
      },
      RECOVER: {
        update: (_c, f) => {
          const s = this.self;
          if (s.state === 'KNOCKDOWN') return null;
          if (this.rng.chance(this.profile.defense) && f < 18) {
            this.hold('block');
            return null;
          }
          return AIState.OBSERVE;
        },
      },
      USE_SKILL: {
        update: (_c, f) => {
          const move = this.chosenSkill;
          if (!move) return AIState.OBSERVE;
          if (f === 0) {
            this.tap(move.slot === 'skill' ? 'skill' : 'special');
            return null;
          }
          return this.self.move ? null : AIState.OBSERVE;
        },
      },
      USE_ULTIMATE: {
        update: (_c, f) => {
          if (f === 0) {
            this.tap('ultimate');
            return null;
          }
          return this.self.move ? null : AIState.OBSERVE;
        },
      },
      DEFEATED: {
        update: () => null,
      },
    };
  }

  private pickSkill(p: Perception): MoveData | null {
    const s = this.self;
    const usable = (m: MoveData | null): m is MoveData => m !== null && !s.skills.check(m, false);
    if (p.gap > 260 && usable(this.roles.zoning)) return this.roles.zoning;
    if (usable(this.roles.approach)) return this.roles.approach;
    if (usable(this.roles.zoning)) return this.roles.zoning;
    return null;
  }
}
