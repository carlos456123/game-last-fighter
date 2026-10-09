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

  constructor(
    readonly owner: Side,
    readonly moveId: string,
    readonly data: ProjectileData,
    public x: number,
    public y: number,
    readonly vx: number,
    readonly vy: number,
    readonly facing: Facing,
  ) {}

  get hit(): HitProperties {
    return this.data.hit;
  }

  step(bounds: { left: number; right: number }): void {
    this.age++;
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
