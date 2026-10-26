import { FRAME_SECONDS } from '@/config/gameConfig';
import type { Facing, HitProperties, ProjectileData, Rect } from '@/types';
import { toWorldBox } from './HitboxSystem';
import type { Side } from '@/characters/Character';

let nextProjectileId = 1;

/** A travelling hit (fireball, shockwave, kunai). Pure data + movement. */
export class Projectile {
  readonly id = nextProjectileId++;
  alive = true;
  /** Destroyed by an opposing projectile (end event already emitted). */
  clashed = false;
  age = 0;
  /** Remaining hits for zone (persistent) projectiles. */
  private hitsLeft: number;
  private rehitCooldown = 0;

  constructor(
    readonly owner: Side,
    readonly moveId: string,
    readonly data: ProjectileData,
    public x: number,
    public y: number,
    readonly vx: number,
    readonly vy: number,
    readonly facing: Facing,
  ) {
    this.hitsLeft = data.persistent?.hits ?? 1;
  }

  /** False while a zone projectile waits between hits. */
  get ready(): boolean {
    return this.rehitCooldown === 0;
  }

  /**
   * Spends one hit. Returns true if the projectile survives (zone projectiles with hits left),
   * false if it should be destroyed.
   */
  absorbHit(): boolean {
    this.hitsLeft--;
    if (!this.data.persistent || this.hitsLeft <= 0) return false;
    this.rehitCooldown = this.data.persistent.interval;
    return true;
  }

  get hit(): HitProperties {
    return this.data.hit;
  }

  step(bounds: { left: number; right: number }): void {
    this.age++;
    if (this.rehitCooldown > 0) this.rehitCooldown--;
    this.x += this.vx * FRAME_SECONDS;
    if (!this.data.grounded) this.y = Math.max(0, this.y + this.vy * FRAME_SECONDS);
    const margin = 120;
    if (this.age >= this.data.lifetime || this.x < bounds.left - margin || this.x > bounds.right + margin) {
      this.alive = false;
    }
  }

  box(): Rect {
    return toWorldBox(this.data.hitbox, this.x, this.y, this.facing);
  }
}
