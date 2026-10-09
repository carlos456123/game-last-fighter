import { COMBAT, FRAME_SECONDS, GRAVITY } from '@/config/gameConfig';
import { SkillSystem, type SkillDenyReason } from '@/combat/SkillSystem';
import { shrinkRect, toWorldBox } from '@/combat/HitboxSystem';
import { InputBuffer } from '@/input/InputBuffer';
import { createInputFrame } from '@/input/InputFrame';
import { approach } from '@/utils/MathUtils';
import type {
  Facing,
  FightButton,
  FighterData,
  HitProperties,
  InputFrame,
  MoveData,
  MoveSlot,
  Rect,
} from '@/types';
import {
  AIR_STATES,
  CharacterState,
  MOVE_STATES,
  NEUTRAL_STATES,
  VULNERABLE_STATES,
  canTransition,
} from './CharacterState';

export type Side = 'p1' | 'p2';
export type MovePhase = 'startup' | 'active' | 'recovery';
export type HitOutcome = 'hit' | 'blocked' | 'armored' | 'ignored';

/** Callbacks the fighter uses to talk to the match without knowing about it. */
export interface CharacterHooks {
  onMoveStart(fighter: Character, move: MoveData): void;
  onProjectile(fighter: Character, move: MoveData): void;
  onDenied(fighter: Character, move: MoveData, reason: SkillDenyReason): void;
  onJump(fighter: Character): void;
  onLand(fighter: Character): void;
  onDodge(fighter: Character): void;
  onTeleport(fighter: Character, fromX: number): void;
  onStun(fighter: Character): void;
  onKnockdown(fighter: Character): void;
  onWhiff(fighter: Character, move: MoveData): void;
}

export interface WorldBounds {
  left: number;
  right: number;
}

const S = CharacterState;
const SLOT_BUTTON: Record<MoveSlot, FightButton> = {
  light: 'light',
  heavy: 'heavy',
  crouchLight: 'light',
  crouchHeavy: 'heavy',
  airLight: 'light',
  airHeavy: 'heavy',
  skill: 'skill',
  special: 'special',
  ultimate: 'ultimate',
};
const GROUND_FRICTION = 2600; // px/s² while sliding from knockback

/**
 * Pure simulation of one fighter. No rendering, no Phaser: it reads an InputFrame per tick
 * and updates position, state, frame data, energy and cooldowns.
 */
export class Character {
  readonly side: Side;
  readonly data: FighterData;
  readonly moves = new Map<string, MoveData>();
  readonly skills: SkillSystem;
  readonly buffer = new InputBuffer();
  private hooks: CharacterHooks;

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: Facing = 1;

  state: CharacterState = S.IDLE;
  stateFrame = 0;
  health: number;
  readonly maxHealth: number;

  move: MoveData | null = null;
  moveFrame = 0;
  /** Increments every time a move starts; lets the combat system identify move instances. */
  moveInstance = 0;
  /** Hit indices already resolved for the current move instance. */
  readonly hitIndicesDone = new Set<number>();
  connected = false;
  hitConfirmed = false;
  private projectileSpawned = false;
  private teleported = false;
  private whiffReported = false;
  armorHitsLeft = 0;
  /** Ultimate lock: the move is frozen on its active frame while scripted hits play. */
  lockActive = false;

  hitstun = 0;
  blockstun = 0;
  stunMeter = 0;
  stunTimer = 0;
  knockdownTimer = 0;
  invulnTimer = 0;
  lockFrames = 0;
  flashFrames = 0;
  launched = false;
  pendingKnockdown = false;
  juggleCount = 0;
  lockedByOpponent = false;
  airJumpsLeft: number;
  dodgeCooldown = 0;
  dodgeDir: Facing = 1;
  perfectDodgeAwarded = false;
  running = false;
  crouchBlocking = false;
  /** Training mode: health never drops below 1. */
  koProtected = false;
  private jumpDir = 0;
  private lastInput: InputFrame = createInputFrame();
  frame = 0;

  constructor(data: FighterData, side: Side, hooks: CharacterHooks) {
    this.data = data;
    this.side = side;
    this.hooks = hooks;
    this.maxHealth = data.stats.health;
    this.health = this.maxHealth;
    this.airJumpsLeft = data.stats.airJumps;
    this.skills = new SkillSystem();
    for (const move of data.moves) this.moves.set(move.id, move);
  }

  // ---------------------------------------------------------------- queries

  get energy(): number {
    return this.skills.energy;
  }

  get airborne(): boolean {
    return this.y > 0 || this.vy > 0;
  }

  get isKO(): boolean {
    return this.health <= 0;
  }

  get input(): InputFrame {
    return this.lastInput;
  }

  get movePhase(): MovePhase | null {
    if (!this.move) return null;
    if (this.moveFrame < this.move.startup) return 'startup';
    if (this.moveFrame < this.move.startup + this.move.active) return 'active';
    return 'recovery';
  }

  get moveTotal(): number {
    return this.move ? this.move.startup + this.move.active + this.move.recovery : 0;
  }

  /** True while the fighter cannot act and the opponent's hits continue a combo. */
  get isVulnerable(): boolean {
    return VULNERABLE_STATES.has(this.state) || this.launched;
  }

  get isCrouching(): boolean {
    return (
      this.state === S.CROUCH ||
      (this.state === S.BLOCK && this.crouchBlocking) ||
      this.move?.slot === 'crouchLight' ||
      this.move?.slot === 'crouchHeavy'
    );
  }

  moveForSlot(slot: MoveSlot): MoveData {
    const id = this.data.slots[slot];
    const move = this.moves.get(id);
    if (!move) throw new Error(`Fighter ${this.data.id} has no move for slot ${slot}`);
    return move;
  }

  isInvulnerable(): boolean {
    if (this.invulnTimer > 0) return true;
    if (this.state === S.KNOCKDOWN || this.state === S.VICTORY) return true;
    if (this.state === S.DEFEAT) return true;
    if (this.launched && this.juggleCount > COMBAT.maxJuggleHits) return true;
    if (this.state === S.DODGE) {
      const inv = this.data.dodge.invulnerable;
      return this.stateFrame >= inv.from && this.stateFrame < inv.to;
    }
    if (this.move?.invulnerable) {
      const inv = this.move.invulnerable;
      return this.moveFrame >= inv.from && this.moveFrame < inv.to;
    }
    return false;
  }

  hasArmor(): boolean {
    if (!this.move?.armor || this.armorHitsLeft <= 0) return false;
    return this.moveFrame >= this.move.armor.from && this.moveFrame < this.move.armor.to;
  }

  hurtboxes(): Rect[] {
    const { width, height } = this.data.body;
    const half = width / 2;
    if (this.state === S.KNOCKDOWN || this.state === S.DEFEAT) {
      return [{ x: this.x - width * 0.8, y: this.y, w: width * 1.6, h: height * 0.24 }];
    }
    const h = this.isCrouching ? height * 0.62 : this.airborne ? height * 0.82 : height;
    const boxes: Rect[] = [{ x: this.x - half, y: this.y, w: width, h }];
    const hb = this.activeOrRecoveryHitbox();
    if (hb) boxes.push(shrinkRect(hb, 0.7));
    return boxes;
  }

  pushbox(): Rect {
    const { width, height } = this.data.body;
    const w = width * 0.8;
    const h = this.isCrouching ? height * 0.62 : height * 0.9;
    return { x: this.x - w / 2, y: this.y, w, h };
  }

  /** World hitbox when the current move is in its active frames. */
  hitbox(): Rect | null {
    if (!this.move?.hitbox || this.movePhase !== 'active') return null;
    return toWorldBox(this.move.hitbox, this.x, this.y, this.facing);
  }

  private activeOrRecoveryHitbox(): Rect | null {
    if (!this.move?.hitbox) return null;
    const phase = this.movePhase;
    if (phase !== 'active' && phase !== 'recovery') return null;
    return toWorldBox(this.move.hitbox, this.x, this.y, this.facing);
  }

  /** Which multi-hit index is currently live, or -1 if none. */
  currentHitIndex(): number {
    if (!this.move || this.movePhase !== 'active' || this.lockActive) return -1;
    const elapsed = this.moveFrame - this.move.startup;
    const per = this.move.active / Math.max(1, this.move.hits);
    return Math.min(this.move.hits - 1, Math.floor(elapsed / per));
  }

  // ---------------------------------------------------------------- state control

  setState(next: CharacterState): boolean {
    if (next === this.state) return true;
    if (!canTransition(this.state, next)) return false;
    this.state = next;
    this.stateFrame = 0;
    if (!MOVE_STATES.has(next)) {
      this.move = null;
      this.lockActive = false;
    }
    return true;
  }

  /** Round reset bypasses the transition table on purpose. */
  resetForRound(x: number, facing: Facing, energy: number): void {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.state = S.IDLE;
    this.stateFrame = 0;
    this.health = this.maxHealth;
    this.move = null;
    this.lockActive = false;
    this.hitstun = this.blockstun = this.stunMeter = this.stunTimer = 0;
    this.knockdownTimer = this.invulnTimer = this.lockFrames = this.flashFrames = 0;
    this.launched = this.pendingKnockdown = this.lockedByOpponent = false;
    this.juggleCount = 0;
    this.airJumpsLeft = this.data.stats.airJumps;
    this.dodgeCooldown = 0;
    this.running = false;
    this.skills.reset(energy);
    this.buffer.clear();
  }

  setVictory(): void {
    this.move = null;
    if (this.setState(S.VICTORY)) this.vx = 0;
  }

  setDefeat(): void {
    this.move = null;
    this.setState(S.DEFEAT);
  }

  // ---------------------------------------------------------------- per-tick update

  /**
   * Feeds input into the buffer. Called every tick, including hitstop and super freeze, with a
   * clock that does not advance while frozen, so presses made during impact pauses are kept.
   */
  receiveInput(clock: number, input: InputFrame): void {
    this.buffer.push(clock, input);
    this.lastInput = input;
  }

  update(frame: number, opponent: Character, bounds: WorldBounds): void {
    this.frame = frame;
    const input = this.lastInput;
    this.tickTimers(input);

    switch (this.state) {
      case S.IDLE:
      case S.WALK:
      case S.RUN:
      case S.CROUCH:
      case S.BLOCK:
        this.updateNeutral(input, opponent);
        break;
      case S.JUMP:
      case S.FALL:
        this.updateAir(input, opponent);
        break;
      case S.ATTACK:
      case S.SPECIAL:
      case S.ULTIMATE:
        this.updateMove(opponent, bounds);
        break;
      case S.DODGE:
        this.updateDodge();
        break;
      case S.HIT:
        this.updateHit(input);
        break;
      case S.STUN:
        this.updateStun(input);
        break;
      case S.KNOCKDOWN:
        this.updateKnockdown();
        break;
      default:
        break;
    }

    this.integrate();
    this.stateFrame++;
  }

  private tickTimers(input: InputFrame): void {
    this.skills.tick();
    if (this.invulnTimer > 0) this.invulnTimer--;
    if (this.flashFrames > 0) this.flashFrames--;
    if (this.dodgeCooldown > 0) this.dodgeCooldown--;
    if (this.blockstun > 0) this.blockstun--;
    if (this.stunMeter > 0 && this.state !== S.HIT) {
      this.stunMeter = Math.max(0, this.stunMeter - COMBAT.stunDecayPerFrame);
    }
    if (this.state === S.STUN && (input.pressed.light || input.pressed.heavy || input.pressed.block)) {
      this.stunTimer = Math.max(0, this.stunTimer - COMBAT.stunMashReduction);
    }
  }

  faceTowards(opponent: Character): void {
    if (opponent.x === this.x) return;
    this.facing = opponent.x > this.x ? 1 : -1;
  }

  private forwardHeld(input: InputFrame): boolean {
    return this.facing === 1 ? input.held.right : input.held.left;
  }

  private backHeld(input: InputFrame): boolean {
    return this.facing === 1 ? input.held.left : input.held.right;
  }

  private horizontal(input: InputFrame): -1 | 0 | 1 {
    if (input.held.left === input.held.right) return 0;
    return input.held.right ? 1 : -1;
  }

  private updateNeutral(input: InputFrame, opponent: Character): void {
    this.faceTowards(opponent);
    if (this.lockFrames > 0) {
      this.lockFrames--;
      this.vx = 0;
      return;
    }
    // Blockstun keeps the fighter in a guard until it expires.
    if (this.blockstun > 0) {
      this.setState(S.BLOCK);
      this.crouchBlocking = input.held.down;
      return;
    }
    if (this.tryActions(input, false)) return;

    const dir = this.horizontal(input);
    // Dodge: block + direction.
    if (this.buffer.has('block', this.frame) && dir !== 0 && this.dodgeCooldown === 0) {
      this.buffer.consume('block', this.frame);
      this.startDodge(dir as Facing);
      return;
    }
    if (input.held.block) {
      this.setState(S.BLOCK);
      this.crouchBlocking = input.held.down;
      this.vx = 0;
      return;
    }
    if (input.held.up || this.buffer.has('up', this.frame)) {
      this.buffer.consume('up', this.frame);
      this.startJump();
      return;
    }
    if (input.held.down) {
      this.setState(S.CROUCH);
      this.vx = 0;
      return;
    }
    const forwardButton: FightButton = this.facing === 1 ? 'right' : 'left';
    if (this.buffer.wasDoubleTapped(forwardButton)) this.running = true;
    if (this.forwardHeld(input)) {
      if (this.running) {
        this.setState(S.RUN);
        this.running = true;
        this.vx = this.facing * this.data.stats.runSpeed;
      } else {
        this.setState(S.WALK);
        this.vx = this.facing * this.data.stats.walkSpeed;
      }
      return;
    }
    this.running = false;
    if (this.backHeld(input)) {
      this.setState(S.WALK);
      this.vx = -this.facing * this.data.stats.backSpeed;
      return;
    }
    this.setState(S.IDLE);
    this.vx = 0;
  }

  /** Tries buffered attack/skill buttons in priority order. Returns true if a move started. */
  private tryActions(input: InputFrame, airborne: boolean): boolean {
    const order: Array<[FightButton, MoveSlot]> = airborne
      ? [
          ['heavy', 'airHeavy'],
          ['light', 'airLight'],
        ]
      : [
          ['ultimate', 'ultimate'],
          ['special', 'special'],
          ['skill', 'skill'],
          ['heavy', input.held.down ? 'crouchHeavy' : 'heavy'],
          ['light', input.held.down ? 'crouchLight' : 'light'],
        ];
    for (const [button, slot] of order) {
      if (!this.buffer.has(button, this.frame)) continue;
      const move = this.moveForSlot(slot);
      const reason = this.skills.check(move, airborne);
      this.buffer.consume(button, this.frame);
      if (reason) {
        if (reason !== 'context') this.hooks.onDenied(this, move, reason);
        continue;
      }
      return this.startMove(move);
    }
    return false;
  }

  startMove(move: MoveData): boolean {
    const target = move.kind === 'ultimate' ? S.ULTIMATE : move.kind === 'special' ? S.SPECIAL : S.ATTACK;
    const fromMove = this.move !== null;
    if (!fromMove || target !== this.state) {
      if (!this.setState(target)) return false;
    } else {
      this.stateFrame = 0;
    }
    this.skills.commit(move);
    this.move = move;
    this.moveFrame = 0;
    this.moveInstance++;
    this.hitIndicesDone.clear();
    this.connected = false;
    this.hitConfirmed = false;
    this.projectileSpawned = false;
    this.teleported = false;
    this.whiffReported = false;
    this.lockActive = false;
    this.armorHitsLeft = move.armor?.hits ?? 0;
    this.running = false;
    if (move.context === 'ground') this.vx = 0;
    this.hooks.onMoveStart(this, move);
    return true;
  }

  private startJump(): void {
    if (!this.setState(S.JUMP)) return;
    this.jumpDir = 0;
    this.vx = 0;
  }

  private startDodge(dir: Facing): void {
    if (!this.setState(S.DODGE)) return;
    this.dodgeDir = dir;
    this.perfectDodgeAwarded = false;
    this.dodgeCooldown = this.data.dodge.cooldown;
    this.vx = (dir * this.data.dodge.distance) / (this.data.dodge.duration * FRAME_SECONDS);
    this.hooks.onDodge(this);
  }

  private updateAir(input: InputFrame, opponent: Character): void {
    // Pre-jump squat on the ground, then take off.
    if (this.state === S.JUMP && this.y === 0 && this.vy === 0) {
      if (this.stateFrame < COMBAT.prejumpFrames) {
        this.jumpDir = this.horizontal(input);
        return;
      }
      this.takeOff(this.horizontal(input) || this.jumpDir, 1);
      return;
    }
    if (this.tryActions(input, true)) return;
    if (input.pressed.up && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.setState(S.JUMP);
      this.takeOff(this.horizontal(input), 0.85);
      this.faceTowards(opponent);
      return;
    }
    // Slight air control.
    const dir = this.horizontal(input);
    if (dir !== 0) {
      const target = dir * this.data.stats.airSpeed;
      this.vx = approach(this.vx, target, this.data.stats.airSpeed * 0.04);
    }
    if (this.vy < 0 && this.state === S.JUMP) this.setState(S.FALL);
  }

  private takeOff(dir: number, strength: number): void {
    this.vy = this.data.stats.jumpVelocity * strength;
    this.vx = dir * this.data.stats.airSpeed;
    this.y = 0.01;
    this.hooks.onJump(this);
  }

  private updateMove(opponent: Character, bounds: WorldBounds): void {
    const move = this.move;
    if (!move) {
      this.setState(this.airborne ? S.FALL : S.IDLE);
      return;
    }
    if (this.lockActive) {
      this.vx = 0;
      return;
    }
    if (this.tryCancel(move)) return;

    const phase = this.movePhase;
    if (move.movement) {
      const m = move.movement;
      const applies = m.phase === 'all' || m.phase === phase;
      if (applies) {
        this.vx = this.facing * m.vx;
        const phaseStart = m.phase === 'active' ? move.startup : 0;
        if (m.vy && this.moveFrame === phaseStart) {
          this.vy = m.vy;
          this.y = Math.max(this.y, 0.01);
        }
      } else if (move.context === 'ground' && !this.airborne) {
        this.vx = approach(this.vx, 0, 40);
      }
    }
    if (move.teleport && !this.teleported && this.moveFrame >= move.teleport.atFrame) {
      this.teleported = true;
      this.teleportBehind(opponent, move.teleport.behindOffset, bounds);
    }
    if (move.projectile && !this.projectileSpawned && phase === 'active') {
      this.projectileSpawned = true;
      this.hooks.onProjectile(this, move);
    }
    if (phase === 'recovery' && !this.connected && !this.whiffReported && move.hitbox) {
      this.whiffReported = true;
      this.hooks.onWhiff(this, move);
    }

    this.moveFrame++;
    if (this.moveFrame >= this.moveTotal) this.endMove();
  }

  private tryCancel(move: MoveData): boolean {
    if (!this.connected) return false;
    const windowEnd = move.startup + move.active + COMBAT.cancelWindowFrames;
    if (this.moveFrame < move.startup || this.moveFrame > windowEnd) return false;
    if (move.chain && this.buffer.has('light', this.frame)) {
      const next = this.moves.get(move.chain);
      if (next && !this.skills.check(next, this.airborne)) {
        this.buffer.consume('light', this.frame);
        return this.startMove(next);
      }
    }
    for (const slot of move.cancels) {
      const resolved = this.resolveCancelSlot(slot);
      const button = SLOT_BUTTON[resolved];
      if (!this.buffer.has(button, this.frame)) continue;
      const next = this.moveForSlot(resolved);
      if (next.id === move.id) continue;
      const reason = this.skills.check(next, this.airborne);
      if (reason) continue;
      this.buffer.consume(button, this.frame);
      return this.startMove(next);
    }
    return false;
  }

  private resolveCancelSlot(slot: MoveSlot): MoveSlot {
    if (slot === 'heavy' && this.lastInput.held.down) return 'crouchHeavy';
    return slot;
  }

  private endMove(): void {
    const next = this.airborne ? S.FALL : this.lastInput.held.down ? S.CROUCH : S.IDLE;
    this.move = null;
    this.lockActive = false;
    this.setState(next);
  }

  private teleportBehind(opponent: Character, offset: number, bounds: WorldBounds): void {
    const fromX = this.x;
    const side = this.x < opponent.x ? 1 : -1;
    let target = opponent.x + side * offset;
    if (target < bounds.left || target > bounds.right) target = opponent.x - side * offset;
    this.x = Math.min(bounds.right, Math.max(bounds.left, target));
    this.faceTowards(opponent);
    this.hooks.onTeleport(this, fromX);
  }

  private updateDodge(): void {
    if (this.stateFrame >= this.data.dodge.duration) {
      this.vx = 0;
      this.setState(this.lastInput.held.down ? S.CROUCH : S.IDLE);
    } else if (this.stateFrame >= this.data.dodge.invulnerable.to) {
      this.vx = approach(this.vx, 0, Math.abs(this.vx) * 0.25 + 10);
    }
  }

  private updateHit(input: InputFrame): void {
    if (this.lockedByOpponent) return;
    if (this.airborne) return; // wait to land
    this.vx = approach(this.vx, 0, GROUND_FRICTION * FRAME_SECONDS);
    if (this.hitstun > 0) {
      this.hitstun--;
      return;
    }
    if (this.stunMeter >= this.data.stats.stunThreshold) {
      this.stunMeter = 0;
      this.stunTimer = COMBAT.stunFrames;
      this.setState(S.STUN);
      this.hooks.onStun(this);
      return;
    }
    this.setState(input.held.down ? S.CROUCH : S.IDLE);
  }

  private updateStun(_input: InputFrame): void {
    this.vx = 0;
    if (this.stunTimer > 0) {
      this.stunTimer--;
      return;
    }
    this.setState(S.IDLE);
  }

  private updateKnockdown(): void {
    this.vx = approach(this.vx, 0, GROUND_FRICTION * FRAME_SECONDS);
    if (this.knockdownTimer > 0) {
      this.knockdownTimer--;
      return;
    }
    if (this.isKO) return;
    if (this.setState(S.IDLE)) this.invulnTimer = COMBAT.wakeupInvulnFrames;
  }

  private integrate(): void {
    const freeze = this.lockedByOpponent || this.lockActive;
    if (freeze) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    const wasAirborne = this.airborne;
    if (wasAirborne) this.vy -= GRAVITY * FRAME_SECONDS;
    this.x += this.vx * FRAME_SECONDS;
    this.y += this.vy * FRAME_SECONDS;
    if (wasAirborne && this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.land();
    }
  }

  private land(): void {
    this.airJumpsLeft = this.data.stats.airJumps;
    const wasLaunched = this.launched;
    this.launched = false;
    this.juggleCount = 0;
    this.hooks.onLand(this);
    switch (this.state) {
      case S.HIT:
        if (this.pendingKnockdown || this.isKO) this.enterKnockdown();
        else if (wasLaunched) this.hitstun = Math.min(this.hitstun, 8);
        break;
      case S.JUMP:
      case S.FALL:
        this.vx = 0;
        this.setState(S.IDLE);
        this.lockFrames = COMBAT.landingLag;
        break;
      case S.ATTACK:
      case S.SPECIAL:
      case S.ULTIMATE: {
        const move = this.move;
        if (move?.context === 'air' || (move && this.movePhase === 'recovery')) {
          this.vx = 0;
          this.setState(S.IDLE);
          this.lockFrames = move.landingLag ?? COMBAT.landingLag;
        }
        break;
      }
      default:
        break;
    }
  }

  private enterKnockdown(): void {
    this.pendingKnockdown = false;
    if (this.isKO) {
      this.setDefeat();
      return;
    }
    if (this.setState(S.KNOCKDOWN)) {
      this.knockdownTimer = COMBAT.knockdownFrames;
      this.hooks.onKnockdown(this);
    }
  }

  // ---------------------------------------------------------------- receiving hits

  /** Whether a hit at the given level would be blocked right now. */
  canBlock(level: HitProperties['level'], attackerX: number): boolean {
    if (this.state !== S.BLOCK) return false;
    const facingAttacker = (attackerX - this.x) * this.facing >= 0;
    if (!facingAttacker) return false;
    if (level === 'low') return this.crouchBlocking;
    if (level === 'overhead') return !this.crouchBlocking;
    return true;
  }

  /**
   * Applies an already-computed hit. Damage maths lives in DamageSystem; this method only
   * changes the defender's state.
   */
  applyHit(hit: HitProperties, damage: number, hitstun: number, attackerX: number): boolean {
    if (this.state !== S.HIT && !canTransition(this.state, S.HIT)) return false;
    this.health = Math.max(this.koProtected ? 1 : 0, this.health - damage);
    this.flashFrames = COMBAT.flashFrames;
    this.hitstun = hitstun;
    this.stunMeter += hit.stun;
    this.blockstun = 0;
    this.move = null;
    this.lockActive = false;
    const dir: Facing = attackerX <= this.x ? 1 : -1;
    this.vx = (dir * hit.knockback) / this.data.stats.weight;
    const airborne = this.airborne;
    if (hit.launch > 0 || airborne || this.isKO) {
      this.launched = true;
      this.juggleCount++;
      const launch = hit.launch > 0 ? hit.launch : this.isKO ? 700 : 380;
      this.vy = launch / Math.sqrt(this.data.stats.weight);
      this.y = Math.max(this.y, 0.01);
    }
    if (hit.knockdown || hit.launch > 0 || this.isKO) this.pendingKnockdown = true;
    // Validated above; assigned directly so repeated hits restart the HIT state.
    this.state = S.HIT;
    this.stateFrame = 0;
    this.running = false;
    return true;
  }

  applyBlock(hit: HitProperties, chipDamage: number, attackerX: number): void {
    this.health = Math.max(1, this.health - chipDamage);
    this.blockstun = hit.blockstun;
    const dir: Facing = attackerX <= this.x ? 1 : -1;
    this.vx = (dir * hit.knockback * COMBAT.blockPushbackScale) / this.data.stats.weight;
  }

  applyArmor(damage: number): void {
    this.health = Math.max(this.koProtected ? 1 : 0, this.health - damage);
    this.armorHitsLeft--;
    this.flashFrames = COMBAT.flashFrames;
  }

  /** Called when the attacker's move connects (hit or block). */
  registerContact(hit: boolean): void {
    this.connected = true;
    if (hit) this.hitConfirmed = true;
  }

  get isNeutral(): boolean {
    return NEUTRAL_STATES.has(this.state);
  }

  get isAirState(): boolean {
    return AIR_STATES.has(this.state);
  }
}
