import Phaser from 'phaser';
import { QUALITY_PRESETS, SHAKE } from '@/config/gameConfig';
import type { Side } from '@/characters/Character';
import type { Projectile } from '@/combat/Projectile';
import type { Match } from '@/core/Match';
import type { HitEvent, MatchEvents } from '@/core/MatchEvents';
import { TEXTURES } from '@/systems/AssetManager';
import type { LocalizationManager } from '@/systems/LocalizationManager';
import type { Settings, ShakeLevel, VfxId } from '@/types';
import { COLORS, DEPTH, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import type { FighterRenderer } from '@/animation/FighterRenderer';

interface ProjectileVisual {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  kind: string;
  color: number;
}

const VFX_COLORS: Record<VfxId, number[]> = {
  spark_light: [0xffffff, 0xfff0b0],
  spark_heavy: [0xffffff, 0xffc24a, 0xff7a45],
  fire: [0xffe08a, 0xff7a2a, 0xff3d1f],
  quake: [0xd8b48a, 0x8a6a4a, 0xffb340],
  shadow: [0xc9a8ff, 0x9b6bff, 0x3fe0c5],
  kunai: [0x3fe0c5, 0xffffff],
  ultimate_burst: [0xffffff, 0xffd34a, 0xff4d2e],
};

/**
 * Visual feedback driven by match events: hit sparks, impact rings, block shields, labels,
 * projectile visuals, ultimate cinematics, screen shake and flashes. Effect counts scale with
 * the quality preset and every effect respects the accessibility settings.
 */
export class VfxManager {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shards: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly aura: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly projectiles = new Map<number, ProjectileVisual>();
  private readonly darken: Phaser.GameObjects.Rectangle;
  private readonly speedLines: Phaser.GameObjects.Graphics;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly burstScale: number;
  private readonly maxBurst: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: Phaser.GameObjects.Layer,
    ui: Phaser.GameObjects.Layer,
    private readonly match: Match,
    private readonly renderers: Record<Side, FighterRenderer>,
    private readonly settings: Readonly<Settings>,
    private readonly i18n: LocalizationManager,
  ) {
    const q = QUALITY_PRESETS[settings.quality];
    this.burstScale = settings.particles ? q.particleScale : 0.15;
    this.maxBurst = settings.particles ? q.maxBurst : 4;
    const emitter = (texture: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) => {
      const e = scene.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(DEPTH.vfx);
      world.add(e);
      return e;
    };
    this.sparks = emitter(TEXTURES.dot, {
      speed: { min: 180, max: 520 },
      lifespan: { min: 180, max: 380 },
      scale: { start: 0.55, end: 0 },
      blendMode: 'ADD',
      gravityY: 600,
    });
    this.shards = emitter(TEXTURES.shard, {
      speed: { min: 120, max: 420 },
      lifespan: { min: 260, max: 520 },
      scale: { start: 0.9, end: 0.1 },
      rotate: { min: 0, max: 360 },
      gravityY: 900,
    });
    this.smoke = emitter(TEXTURES.smoke, {
      speed: { min: 20, max: 90 },
      lifespan: { min: 400, max: 800 },
      scale: { start: 0.6, end: 1.6 },
      alpha: { start: 0.5, end: 0 },
    });
    this.trail = emitter(TEXTURES.glow, {
      speed: { min: 0, max: 30 },
      lifespan: 260,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
    });
    this.aura = emitter(TEXTURES.ember, {
      speedY: { min: -120, max: -60 },
      speedX: { min: -30, max: 30 },
      lifespan: 600,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
    });

    this.darken = scene.add
      .rectangle(0, 0, 4000, 3000, 0x05030a, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.fighters - 1);
    world.add(this.darken);
    this.darken.setPosition(-1200, -1200);
    this.speedLines = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1);
    ui.add(this.speedLines);
    this.bind();
  }

  private bind(): void {
    const ev = this.match.events;
    const on = <K extends keyof MatchEvents>(k: K, fn: (payload: MatchEvents[K]) => void): void => {
      this.unsubscribers.push(ev.on(k, fn));
    };
    on('hit', (e) => this.onHit(e));
    on('block', (e) => {
      this.ringAt(e.x, this.toScreenY(e.y), COLORS.energy, 0.6);
      this.burst(this.sparks, e.x, this.toScreenY(e.y), 6, [0x9fd8ff, 0xffffff]);
      this.label(e.x, this.toScreenY(e.y) - 40, this.i18n.t('battle.blocked'), TEXT_COLORS.cyan, TYPE.small);
    });
    on('perfectDodge', (e) => {
      this.ringAt(e.x, this.toScreenY(e.y), COLORS.cyan, 1.2);
      this.label(
        e.x,
        this.toScreenY(e.y) - 70,
        this.i18n.t('battle.perfectDodge'),
        TEXT_COLORS.cyan,
        TYPE.body,
      );
    });
    on('teleport', (e) => {
      const y = this.toScreenY(e.y + 90);
      this.burst(this.smoke, e.fromX, y, 8, [0x2a1c40]);
      this.burst(this.smoke, e.toX, y, 8, [0x2a1c40]);
      this.burst(this.shards, e.toX, y, 6, VFX_COLORS.shadow);
    });
    on('stun', (e) => {
      const f = this.match.fighter(e.fighter);
      this.label(
        f.x,
        this.toScreenY(f.data.body.height + 50),
        this.i18n.t('battle.stunned'),
        TEXT_COLORS.gold,
        TYPE.h3,
      );
    });
    on('land', (e) => {
      const f = this.match.fighter(e.fighter);
      this.burst(this.smoke, f.x, this.match.arena.floorY, 3, [0x8a7a70]);
    });
    on('knockdown', (e) => {
      const f = this.match.fighter(e.fighter);
      this.burst(this.smoke, f.x, this.match.arena.floorY, 8, [0x8a7a70]);
      this.shake('light');
    });
    on('ultimateStart', (e) => this.ultimateCinematic(e.fighter, e.freeze));
    on('projectileSpawn', (e) => this.spawnProjectile(e.id, e.visual, e.owner));
    on('projectileEnd', (e) => this.endProjectile(e.id, e.x, e.y, e.clash));
    on('ko', () => {
      this.flash(COLORS.white, 300);
      this.shake('heavy');
    });
    on('denied', (e) => {
      if (e.fighter !== 'p1') return;
      const f = this.match.fighter(e.fighter);
      const key = e.reason === 'energy' ? 'battle.noEnergy' : 'battle.cooldown';
      this.label(
        f.x,
        this.toScreenY(f.data.body.height + 30),
        this.i18n.t(key),
        TEXT_COLORS.danger,
        TYPE.small,
      );
    });
  }

  private toScreenY(simY: number): number {
    return this.match.arena.floorY - simY;
  }

  private onHit(e: HitEvent): void {
    const x = e.x;
    const y = this.toScreenY(e.y);
    const colors = VFX_COLORS[e.vfx];
    const heavy =
      e.shake === 'medium' || e.shake === 'heavy' || e.vfx === 'spark_heavy' || e.vfx === 'ultimate_burst';
    this.burst(this.sparks, x, y, heavy ? 16 : 8, colors);
    if (heavy) {
      this.burst(this.shards, x, y, 8, colors);
      this.ringAt(x, y, colors[colors.length - 1], e.vfx === 'ultimate_burst' ? 2.2 : 1.1);
    }
    if (e.vfx === 'quake') this.burst(this.smoke, x, this.match.arena.floorY, 10, [0x9a8470]);
    if (e.vfx === 'fire') this.burst(this.trail, x, y, 6, colors);
    if (e.armored) this.label(x, y - 50, this.i18n.t('battle.armor'), TEXT_COLORS.gold, TYPE.small);
    if (e.shake !== 'none') this.shake(e.shake);
    if (e.vfx === 'ultimate_burst') this.flash(COLORS.gold, 120);
  }

  private burst(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter,
    x: number,
    y: number,
    count: number,
    tint: number[],
  ): void {
    const n = Math.max(1, Math.min(this.maxBurst, Math.round(count * this.burstScale)));
    emitter.setParticleTint({ onEmit: () => Phaser.Utils.Array.GetRandom(tint) as number });
    emitter.explode(n, x, y);
  }

  private ringAt(x: number, y: number, color: number, size: number): void {
    let ring = this.rings.find((r) => !r.visible);
    if (!ring) {
      ring = this.scene.add.image(0, 0, TEXTURES.ring).setBlendMode('ADD').setDepth(DEPTH.vfx);
      this.world.add(ring);
      this.rings.push(ring);
    }
    ring
      .setPosition(x, y)
      .setTint(color)
      .setScale(0.3 * size)
      .setAlpha(1)
      .setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      scale: 1.4 * size,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => ring.setVisible(false),
    });
  }

  /** Floating text in world space. Information is always text + colour, never colour alone. */
  label(x: number, y: number, text: string, color: string, size: number): void {
    let t = this.labels.find((l) => !l.visible);
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', textStyle({ font: 'display', size, stroke: true }))
        .setOrigin(0.5)
        .setDepth(DEPTH.vfx + 1);
      this.world.add(t);
      this.labels.push(t);
    }
    t.setText(text)
      .setColor(color)
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.6)
      .setVisible(true);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      delay: 450,
      duration: 400,
      onComplete: () => t.setVisible(false),
    });
  }

  shake(level: ShakeLevel): void {
    if (level === 'none' || !this.settings.screenShake) return;
    const s = SHAKE[level];
    this.scene.cameras.main.shake(s.duration, s.intensity);
  }

  flash(color: number, ms: number): void {
    if (this.settings.reduceFlashes) return;
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.scene.cameras.main.flash(ms, c.red, c.green, c.blue, true);
  }

  private ultimateCinematic(side: Side, freeze: number): void {
    const f = this.match.fighter(side);
    const ms = (freeze / 60) * 1000;
    this.darken.setFillStyle(0x05030a, 1).setAlpha(0);
    this.scene.tweens.add({ targets: this.darken, alpha: 0.72, duration: 120, yoyo: true, hold: ms - 160 });
    this.burst(this.aura, f.x, this.toScreenY(f.data.body.height * 0.5), 30, [
      f.data.palette.energy,
      0xffffff,
    ]);
    this.ringAt(f.x, this.toScreenY(f.data.body.height * 0.5), f.data.palette.energy, 2.5);
    this.flash(f.data.palette.energy, 160);
    // Speed lines radiating from the screen centre.
    const g = this.speedLines;
    g.clear();
    if (!this.settings.reduceFlashes) {
      g.lineStyle(3, 0xffffff, 0.25);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        g.lineBetween(
          640 + Math.cos(a) * 300,
          360 + Math.sin(a) * 300,
          640 + Math.cos(a) * 900,
          360 + Math.sin(a) * 900,
        );
      }
      g.setAlpha(1);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Quad.In' });
    }
    this.shake('medium');
  }

  private spawnProjectile(id: number, visual: string, owner: Side): void {
    const color = this.match.fighter(owner).data.palette.energy;
    let sprite: ProjectileVisual['sprite'];
    if (visual === 'fireball') {
      sprite = this.scene.add.image(0, 0, TEXTURES.glow).setTint(color).setBlendMode('ADD').setScale(1.3);
    } else {
      sprite = this.scene.add.graphics();
    }
    sprite.setDepth(DEPTH.projectiles);
    this.world.add(sprite);
    this.projectiles.set(id, { sprite, kind: visual, color });
  }

  private endProjectile(id: number, x: number, simY: number, clash: boolean): void {
    const v = this.projectiles.get(id);
    if (!v) return;
    v.sprite.destroy();
    this.projectiles.delete(id);
    const y = this.toScreenY(simY);
    this.burst(this.sparks, x, y, clash ? 14 : 6, [v.color, 0xffffff]);
    if (clash) this.ringAt(x, y, v.color, 1);
  }

  /** Per-frame sync of projectile visuals and the full-energy aura. */
  update(projectiles: readonly Projectile[], clock: number): void {
    for (const p of projectiles) {
      const v = this.projectiles.get(p.id);
      if (!v) continue;
      const x = p.x;
      const y = this.toScreenY(p.y);
      if (v.kind === 'fireball' && v.sprite instanceof Phaser.GameObjects.Image) {
        v.sprite.setPosition(x, y).setScale(1.2 + Math.sin(clock * 0.6) * 0.15);
        if (clock % 2 === 0) this.burst(this.trail, x - p.facing * 10, y, 2, [v.color, 0xffe08a]);
      } else if (v.sprite instanceof Phaser.GameObjects.Graphics) {
        const g = v.sprite;
        g.clear();
        if (v.kind === 'shockwave') {
          g.fillStyle(v.color, 0.85);
          g.fillTriangle(x - 34, y, x + 34 * p.facing, y, x, y - 46 - Math.sin(clock * 0.8) * 8);
          g.fillStyle(0xffffff, 0.6);
          g.fillTriangle(x - 16, y, x + 16 * p.facing, y, x, y - 26);
          if (clock % 3 === 0) this.burst(this.smoke, x, y, 1, [0x9a8470]);
        } else {
          // Kunai: a small blade pointing in the travel direction.
          const angle = Math.atan2(-p.vy, p.vx);
          const dx = Math.cos(angle) * 18;
          const dy = Math.sin(angle) * 18;
          g.lineStyle(5, 0x000000, 1);
          g.lineBetween(x - dx, y - dy, x + dx, y + dy);
          g.lineStyle(3, v.color, 1);
          g.lineBetween(x - dx, y - dy, x + dx, y + dy);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(x + dx, y + dy, 2);
        }
      }
    }
    if (this.settings.particles && clock % 6 === 0) {
      for (const f of this.match.fighters) {
        if (f.energy >= f.skills.maxEnergy && !f.isKO) {
          const r = this.renderers[f.side];
          this.burst(this.aura, r.anchors.chest.x + Phaser.Math.Between(-20, 20), r.anchors.chest.y + 40, 2, [
            f.data.palette.energy,
          ]);
        }
      }
    }
  }

  destroy(): void {
    for (const u of this.unsubscribers) u();
    for (const v of this.projectiles.values()) v.sprite.destroy();
    this.projectiles.clear();
  }
}
