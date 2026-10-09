import { COMBAT } from '@/config/gameConfig';
import type { Character, WorldBounds } from '@/characters/Character';
import type { EventBus } from '@/core/EventBus';
import type { HitEvent, MatchEvents } from '@/core/MatchEvents';
import type { HitProperties, MoveData, Rect } from '@/types';
import { rectsOverlap } from '@/utils/MathUtils';
import { ComboSystem } from './ComboSystem';
import { computeChip, computeDamage, comboHitstunScale, energyFromDamageTaken } from './DamageSystem';
import { overlapCenter } from './HitboxSystem';
import { Projectile } from './Projectile';
import { isCornered, resolvePush } from './PushSystem';

interface PendingHit {
  attacker: Character;
  defender: Character;
  move: MoveData;
  hit: HitProperties;
  point: { x: number; y: number };
  projectile: Projectile | null;
}

interface LockTimer {
  hitsLeft: number;
  timer: number;
}

/**
 * Resolves everything that happens between fighters each tick: projectiles, hit detection,
 * blocking, armor, damage, combos, ultimate locks and physical separation.
 */
export class CombatSystem {
  readonly projectiles: Projectile[] = [];
  readonly combos = new ComboSystem();
  private readonly locks = new Map<Character, LockTimer>();

  constructor(private readonly events: EventBus<MatchEvents>) {}

  spawnProjectile(owner: Character, move: MoveData): void {
    const p = move.projectile;
    if (!p) return;
    for (let i = 0; i < p.count; i++) {
      const offset = i - (p.count - 1) / 2;
      const x = owner.x + owner.facing * p.spawn.x;
      const y = owner.y + p.spawn.y;
      const proj = new Projectile(
        owner.side,
        move.id,
        p,
        x,
        y,
        owner.facing * p.speed,
        offset * p.spread,
        owner.facing,
      );
      this.projectiles.push(proj);
      this.events.emit('projectileSpawn', { owner: owner.side, id: proj.id, visual: p.visual, x, y });
    }
  }

  /** Runs one combat tick and returns the hitstop (in frames) the match should apply. */
  step(fighters: [Character, Character], bounds: WorldBounds): number {
    const [a, b] = fighters;
    this.stepProjectiles(bounds);
    const pending: PendingHit[] = [];
    this.collectMelee(a, b, pending);
    this.collectMelee(b, a, pending);
    this.collectProjectiles(fighters, pending);
    let hitstop = 0;
    // Hits are applied after collection so simultaneous hits trade.
    for (const p of pending) hitstop = Math.max(hitstop, this.resolve(p, bounds));
    hitstop = Math.max(hitstop, this.stepLock(a, b), this.stepLock(b, a));
    this.trackCombos(a, b);
    this.trackCombos(b, a);
    resolvePush(a, b, bounds);
    return hitstop;
  }

  isLocking(fighter: Character): boolean {
    return this.locks.has(fighter);
  }

  private stepProjectiles(bounds: WorldBounds): void {
    for (const p of this.projectiles) p.step(bounds);
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const p = this.projectiles[i];
        const q = this.projectiles[j];
        if (!p.alive || !q.alive || p.owner === q.owner) continue;
        const pb = p.box();
        const qb = q.box();
        if (!rectsOverlap(pb, qb)) continue;
        p.alive = false;
        q.alive = false;
        const c = overlapCenter(pb, qb);
        this.events.emit('projectileEnd', { id: p.id, x: c.x, y: c.y, clash: true });
        this.events.emit('projectileEnd', { id: q.id, x: c.x, y: c.y, clash: true });
        p.clashed = true;
        q.clashed = true;
      }
    }
    this.prune();
  }

  private prune(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.alive) continue;
      if (!p.clashed) this.events.emit('projectileEnd', { id: p.id, x: p.x, y: p.y, clash: false });
      this.projectiles.splice(i, 1);
    }
  }

  private collectMelee(attacker: Character, defender: Character, out: PendingHit[]): void {
    const move = attacker.move;
    const hitbox = attacker.hitbox();
    if (!move || !hitbox || attacker.lockedByOpponent) return;
    const index = attacker.currentHitIndex();
    if (index < 0 || attacker.hitIndicesDone.has(index)) return;
    if (move.groundedTargetsOnly && defender.airborne) return;
    const hurt = firstOverlap(hitbox, defender.hurtboxes());
    if (!hurt) return;
    if (defender.isInvulnerable()) {
      this.checkPerfectDodge(defender);
      return;
    }
    attacker.hitIndicesDone.add(index);
    out.push({
      attacker,
      defender,
      move,
      hit: move.hit,
      point: overlapCenter(hitbox, hurt),
      projectile: null,
    });
  }

  private collectProjectiles(fighters: [Character, Character], out: PendingHit[]): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const attacker = fighters[0].side === p.owner ? fighters[0] : fighters[1];
      const defender = attacker === fighters[0] ? fighters[1] : fighters[0];
      if (p.data.grounded && defender.airborne) continue;
      const box = p.box();
      const hurt = firstOverlap(box, defender.hurtboxes());
      if (!hurt) continue;
      if (defender.isInvulnerable()) {
        this.checkPerfectDodge(defender);
        continue;
      }
      p.alive = false;
      const move = attacker.moves.get(p.moveId);
      if (!move) continue;
      out.push({ attacker, defender, move, hit: p.hit, point: overlapCenter(box, hurt), projectile: p });
    }
    this.prune();
  }

  private checkPerfectDodge(defender: Character): void {
    if (defender.state !== 'DODGE' || defender.perfectDodgeAwarded) return;
    const inv = defender.data.dodge.invulnerable;
    if (defender.stateFrame > inv.from + COMBAT.perfectDodgeWindow) return;
    defender.perfectDodgeAwarded = true;
    this.gainEnergy(defender, COMBAT.energyPerfectDodge);
    this.events.emit('perfectDodge', {
      fighter: defender.side,
      x: defender.x,
      y: defender.y + defender.data.body.height * 0.6,
    });
  }

  /** Applies one hit and returns its hitstop. */
  private resolve(
    { attacker, defender, move, hit, point, projectile }: PendingHit,
    bounds: WorldBounds,
  ): number {
    const shared = { attacker: attacker.side, defender: defender.side, moveId: move.id };
    const comboIndex = this.combos.nextIndex(attacker.side, defender.isVulnerable);
    const damage = computeDamage({
      base: hit.damage,
      strength: attacker.data.stats.strength,
      defense: defender.data.stats.defense,
      comboIndex,
    });

    if (defender.canBlock(hit.level, attacker.x)) {
      const chip = computeChip(damage, hit.chip);
      defender.applyBlock(hit, chip, attacker.x);
      if (!projectile) attacker.registerContact(false);
      this.gainEnergy(attacker, hit.energyGain * COMBAT.energyOnBlockAttacker);
      this.gainEnergy(defender, COMBAT.energyOnBlockDefender);
      this.wallPushback(attacker, defender, hit.knockback * COMBAT.blockPushbackScale, projectile, bounds);
      this.events.emit('block', { ...shared, chip, x: point.x, y: point.y });
      return Math.ceil(hit.hitstop * 0.6);
    }

    const base: Omit<HitEvent, 'damage' | 'combo' | 'armored' | 'shake'> = {
      ...shared,
      x: point.x,
      y: point.y,
      level: hit.level,
      vfx: hit.vfx,
      sfx: hit.sfx,
      projectile: projectile !== null,
      ultimate: move.kind === 'ultimate',
    };

    if (defender.hasArmor()) {
      const absorbed = Math.max(1, Math.round(damage * 0.6));
      defender.applyArmor(absorbed);
      if (!projectile) attacker.registerContact(true);
      this.gainEnergy(attacker, hit.energyGain * 0.5);
      this.events.emit('hit', { ...base, damage: absorbed, combo: 0, armored: true, shake: 'light' });
      return hit.hitstop;
    }

    const hitstun = Math.round(hit.hitstun * comboHitstunScale(comboIndex));
    if (!defender.applyHit(hit, damage, hitstun, attacker.x)) return 0;
    const combo = this.combos.registerHit(attacker.side, damage, comboIndex > 1);
    if (!projectile) attacker.registerContact(true);
    this.gainEnergy(attacker, hit.energyGain);
    this.gainEnergy(defender, energyFromDamageTaken(damage));
    this.wallPushback(attacker, defender, hit.knockback, projectile, bounds);
    this.events.emit('hit', { ...base, damage, combo, armored: false, shake: hit.shake });
    if (move.lock && !projectile && attacker.move === move && !defender.isKO)
      this.beginLock(attacker, defender);
    return hit.hitstop;
  }

  /** When the defender is pinned against a wall, the attacker is pushed back instead. */
  private wallPushback(
    attacker: Character,
    defender: Character,
    knockback: number,
    projectile: Projectile | null,
    bounds: WorldBounds,
  ): void {
    if (projectile || attacker.airborne || !isCornered(defender, bounds)) return;
    attacker.vx = -attacker.facing * knockback * COMBAT.wallPushback;
  }

  private beginLock(attacker: Character, defender: Character): void {
    const lock = attacker.move?.lock;
    if (!lock) return;
    attacker.lockActive = true;
    this.locks.set(attacker, { hitsLeft: lock.hits, timer: lock.interval });
    defender.lockedByOpponent = true;
    defender.vx = 0;
    defender.vy = 0;
  }

  private stepLock(attacker: Character, defender: Character): number {
    const lock = this.locks.get(attacker);
    if (!lock) return 0;
    const move = attacker.move;
    if (!move?.lock || attacker.isKO) {
      this.releaseLock(attacker, defender);
      return 0;
    }
    lock.timer--;
    if (lock.timer > 0) return 0;
    const isFinal = lock.hitsLeft <= 0 || defender.health <= 0;
    const hit = isFinal ? move.lock.final : move.lock.hit;
    const comboIndex = this.combos.nextIndex(attacker.side, true);
    const damage = computeDamage({
      base: hit.damage,
      strength: attacker.data.stats.strength,
      defense: defender.data.stats.defense,
      comboIndex,
    });
    if (isFinal) this.releaseLock(attacker, defender);
    else defender.lockedByOpponent = false;
    defender.applyHit(hit, damage, hit.hitstun, attacker.x);
    if (!isFinal) {
      defender.lockedByOpponent = true;
      defender.vx = 0;
      defender.vy = 0;
      lock.hitsLeft--;
      lock.timer = move.lock.interval;
    }
    const combo = this.combos.registerHit(attacker.side, damage, true);
    this.gainEnergy(defender, energyFromDamageTaken(damage) * 0.5);
    this.events.emit('hit', {
      attacker: attacker.side,
      defender: defender.side,
      moveId: move.id,
      damage,
      combo,
      x: (attacker.x + defender.x) / 2,
      y: defender.y + defender.data.body.height * 0.55,
      level: hit.level,
      vfx: hit.vfx,
      sfx: hit.sfx,
      shake: hit.shake,
      projectile: false,
      armored: false,
      ultimate: true,
    });
    return hit.hitstop;
  }

  private releaseLock(attacker: Character, defender: Character): void {
    this.locks.delete(attacker);
    attacker.lockActive = false;
    defender.lockedByOpponent = false;
  }

  private trackCombos(attacker: Character, defender: Character): void {
    if (!this.combos.current(attacker.side)) return;
    if (defender.isVulnerable || defender.lockedByOpponent) return;
    const result = this.combos.end(attacker.side);
    if (result) this.events.emit('comboEnd', { attacker: attacker.side, ...result });
  }

  private gainEnergy(fighter: Character, amount: number): void {
    if (fighter.skills.gain(amount)) this.events.emit('energyFull', { fighter: fighter.side });
  }

  reset(): void {
    this.projectiles.length = 0;
    this.combos.reset();
    this.locks.clear();
  }
}

const firstOverlap = (box: Rect, targets: Rect[]): Rect | null => {
  for (const t of targets) if (rectsOverlap(box, t)) return t;
  return null;
};
