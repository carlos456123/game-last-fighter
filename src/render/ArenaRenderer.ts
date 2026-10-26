import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, QUALITY_PRESETS } from '@/config/gameConfig';
import { TEXTURES } from '@/systems/AssetManager';
import type { ArenaData, ArenaLayer, Quality } from '@/types';
import { DEPTH } from '@/ui/theme';
import { Rng } from '@/utils/MathUtils';

const OVERSCAN = 500;

/**
 * Builds an arena from its data: parallax silhouettes, lighting, props, floor and ambient
 * particles. Decoration never touches gameplay: limits come only from ArenaData.bounds.
 */
export class ArenaRenderer {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private flames: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly arena: ArenaData,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly quality: Quality,
    particles: boolean,
  ) {
    for (const l of arena.layers) this.build(l);
    if (particles) this.ambient();
  }

  private addObj<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.layer.add(obj);
    this.objects.push(obj);
    return obj;
  }

  private build(l: ArenaLayer): void {
    const s = this.scene;
    const a = this.arena;
    switch (l.type) {
      case 'sky': {
        const g = this.addObj(s.add.graphics().setScrollFactor(0).setDepth(DEPTH.background));
        g.fillGradientStyle(l.top, l.top, l.bottom, l.bottom, 1);
        g.fillRect(-OVERSCAN, -OVERSCAN, GAME_WIDTH + OVERSCAN * 2, GAME_HEIGHT + OVERSCAN * 2);
        break;
      }
      case 'sun': {
        const g = this.addObj(
          s.add
            .graphics()
            .setScrollFactor(0.05)
            .setDepth(DEPTH.background + 1),
        );
        const x = GAME_WIDTH * l.x;
        for (let r = l.radius * 3; r > l.radius; r -= 12) {
          g.fillStyle(l.glow, 0.035);
          g.fillCircle(x, l.y, r);
        }
        g.fillStyle(l.color, 1);
        g.fillCircle(x, l.y, l.radius);
        g.setBlendMode('ADD');
        break;
      }
      case 'silhouette': {
        const g = this.addObj(
          s.add
            .graphics()
            .setScrollFactor(l.scroll, 1)
            .setDepth(DEPTH.background + 2),
        );
        g.setAlpha(l.alpha);
        this.drawSilhouette(g, l);
        break;
      }
      case 'props':
        this.drawProps(l);
        break;
      case 'floor': {
        const g = this.addObj(s.add.graphics().setDepth(DEPTH.world));
        const y = a.floorY;
        g.fillStyle(l.color, 1);
        g.fillRect(-OVERSCAN, y, a.width + OVERSCAN * 2, GAME_HEIGHT + OVERSCAN);
        g.fillStyle(0x000000, 0.25);
        g.fillRect(-OVERSCAN, y + 40, a.width + OVERSCAN * 2, GAME_HEIGHT);
        g.lineStyle(2, l.lineColor, 1);
        if (l.pattern === 'stone') {
          for (let row = 0; row < 4; row++) {
            const ry = y + 14 + row * 28 + row * row * 4;
            g.lineBetween(-OVERSCAN, ry, a.width + OVERSCAN, ry);
            const step = 120 + row * 40;
            for (let x = (row % 2) * (step / 2) - OVERSCAN; x < a.width + OVERSCAN; x += step)
              g.lineBetween(x, ry, x - 12, ry + 28);
          }
        } else {
          for (let x = -OVERSCAN; x < a.width + OVERSCAN; x += 80) g.lineBetween(x, y, x - 60, y + 160);
          for (let row = 1; row < 4; row++)
            g.lineBetween(-OVERSCAN, y + row * 34, a.width + OVERSCAN, y + row * 34);
        }
        // Bright edge: the floor line is always clearly readable.
        g.lineStyle(4, l.edgeColor, 0.9);
        g.lineBetween(-OVERSCAN, y, a.width + OVERSCAN, y);
        g.lineStyle(12, l.edgeColor, 0.12);
        g.lineBetween(-OVERSCAN, y + 2, a.width + OVERSCAN, y + 2);
        // Arena limits: subtle pylons so the player understands where the walls are.
        g.fillStyle(l.edgeColor, 0.35);
        g.fillRect(a.bounds.left - 14, y - 260, 6, 260);
        g.fillRect(a.bounds.right + 8, y - 260, 6, 260);
        break;
      }
      default:
        break;
    }
  }

  private drawSilhouette(
    g: Phaser.GameObjects.Graphics,
    l: Extract<ArenaLayer, { type: 'silhouette' }>,
  ): void {
    const rng = new Rng(l.seed);
    const width = this.arena.width * l.scroll + GAME_WIDTH * 1.6;
    const start = -GAME_WIDTH * 0.4;
    g.fillStyle(l.color, 1);
    const base = l.baseY;
    switch (l.shape) {
      case 'mountains': {
        g.beginPath();
        g.moveTo(start, base + 200);
        for (let x = start; x <= start + width; x += 60) g.lineTo(x, base - rng.range(0.3, 1) * l.height);
        g.lineTo(start + width, base + 200);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'arches': {
        g.fillRect(start, base - l.height * 0.15, width, l.height + 200);
        for (let x = start; x < start + width; x += 110) {
          const broken = rng.chance(0.25);
          const h = broken ? l.height * rng.range(0.4, 0.75) : l.height;
          g.fillRect(x, base - h, 26, h);
          if (!broken) g.fillRect(x, base - h, 110, 24);
        }
        // Arch openings (cut-outs drawn darker to suggest depth)
        g.fillStyle(0x000000, 0.35);
        for (let x = start + 30; x < start + width; x += 110)
          g.fillRect(x, base - l.height * 0.6, 60, l.height * 0.45);
        break;
      }
      case 'pillars': {
        for (let x = start; x < start + width; x += rng.range(380, 560)) {
          const h = l.height * rng.range(0.5, 1);
          const w = rng.range(46, 70);
          g.fillRect(x, base - h, w, h);
          g.fillTriangle(
            x,
            base - h,
            x + w,
            base - h,
            x + w * rng.range(0.2, 0.8),
            base - h - rng.range(20, 60),
          );
          g.fillRect(x - 10, base - 18, w + 20, 18);
        }
        break;
      }
      case 'towers':
      case 'skyline': {
        const windowColor = l.shape === 'towers' ? 0x3fe0c5 : 0xff5fa8;
        for (let x = start; x < start + width;) {
          const w = rng.range(60, 140);
          const h = l.height * rng.range(0.35, 1);
          g.fillStyle(l.color, 1);
          g.fillRect(x, base - h, w, h + 200);
          if (rng.chance(0.4)) g.fillRect(x + w / 2 - 2, base - h - 40, 4, 40);
          g.fillStyle(windowColor, l.shape === 'towers' ? 0.28 : 0.18);
          for (let wy = base - h + 16; wy < base - 10; wy += 22) {
            for (let wx = x + 10; wx < x + w - 12; wx += 18) if (rng.chance(0.35)) g.fillRect(wx, wy, 8, 10);
          }
          x += w + rng.range(4, 30);
        }
        break;
      }
      case 'industrial': {
        // Stacked factory blocks, chimneys, pipes and a few warm work lights.
        for (let x = start; x < start + width;) {
          const w = rng.range(90, 180);
          const h = l.height * rng.range(0.45, 1);
          g.fillStyle(l.color, 1);
          g.fillRect(x, base - h, w, h + 200);
          if (rng.chance(0.6)) {
            const cx = x + rng.range(10, w - 30);
            g.fillRect(cx, base - h - rng.range(40, 90), 18, 90);
          }
          if (rng.chance(0.5)) g.fillRect(x - 20, base - h * rng.range(0.3, 0.7), w + 40, 8);
          g.fillStyle(0xff8a3d, 0.35);
          for (let i = 0; i < 3; i++)
            if (rng.chance(0.5)) g.fillRect(x + rng.range(8, w - 14), base - rng.range(20, h - 10), 6, 6);
          x += w + rng.range(-10, 24);
        }
        break;
      }
      case 'temple': {
        // Ruined pagoda-like shrines with tiered roofs, columns and broken stairs.
        for (let x = start; x < start + width; x += rng.range(260, 380)) {
          const w = rng.range(150, 230);
          const h = l.height * rng.range(0.55, 1);
          g.fillStyle(l.color, 1);
          g.fillRect(x + w * 0.15, base - h * 0.55, w * 0.7, h * 0.55 + 200);
          for (let tier = 0; tier < 3; tier++) {
            const ty = base - h * (0.55 + tier * 0.17);
            const tw = w * (1.1 - tier * 0.25);
            const tx = x + (w - tw) / 2;
            g.fillTriangle(tx - 20, ty, tx + tw + 20, ty, tx + tw / 2, ty - h * 0.12);
            if (!(tier === 2 && rng.chance(0.4))) g.fillRect(tx + 10, ty - h * 0.08, tw - 20, h * 0.08);
          }
          for (let c = 0; c < 4; c++) g.fillRect(x + w * 0.2 + c * w * 0.18, base - h * 0.5, 10, h * 0.5);
          g.fillRect(x - 10, base - 20, w + 20, 20);
        }
        break;
      }
      default:
        break;
    }
  }

  private drawProps(l: Extract<ArenaLayer, { type: 'props' }>): void {
    const s = this.scene;
    const g = this.addObj(
      s.add
        .graphics()
        .setScrollFactor(l.scroll, 1)
        .setDepth(DEPTH.background + 3),
    );
    const width = this.arena.width * l.scroll + GAME_WIDTH * 1.4;
    const floor = this.arena.floorY;
    for (let x = 120; x < width; x += l.spacing) {
      if (l.kind === 'torches') {
        g.fillStyle(0x1a0e10, 1);
        g.fillRect(x - 5, floor - 200, 10, 200);
        g.fillRect(x - 16, floor - 206, 32, 10);
        const flame = this.addObj(s.add.image(x, floor - 222, TEXTURES.glow).setScrollFactor(l.scroll, 1));
        flame
          .setTint(l.color)
          .setBlendMode('ADD')
          .setScale(1.4)
          .setDepth(DEPTH.background + 3);
        this.flames.push(flame);
      } else if (l.kind === 'braziers') {
        g.fillStyle(0x1a1210, 1);
        g.fillRect(x - 10, floor - 110, 20, 110);
        g.fillTriangle(x - 34, floor - 130, x + 34, floor - 130, x, floor - 104);
        g.fillRect(x - 36, floor - 136, 72, 8);
        const flame = this.addObj(s.add.image(x, floor - 150, TEXTURES.glow).setScrollFactor(l.scroll, 1));
        flame
          .setTint(l.color)
          .setBlendMode('ADD')
          .setScale(1.8)
          .setDepth(DEPTH.background + 3);
        this.flames.push(flame);
      } else if (l.kind === 'signs') {
        // Neon sign boards: alternate between the arena colour and cyan for variety.
        const color = (x / l.spacing) % 2 < 1 ? l.color : 0x3fe0ff;
        const h = 90 + ((x * 7) % 60);
        g.fillStyle(0x0b0816, 1);
        g.fillRect(x - 3, floor - 300, 6, 300);
        g.fillRect(x - 24, floor - 300 - h, 48, h);
        g.lineStyle(3, color, 0.9);
        g.strokeRect(x - 20, floor - 296 - h, 40, h - 8);
        g.fillStyle(color, 0.7);
        for (let i = 0; i < 3; i++) g.fillRect(x - 10, floor - 286 - h + i * (h / 3.2), 20, 6);
        const glow = this.addObj(
          s.add.image(x, floor - 300 - h / 2, TEXTURES.glow).setScrollFactor(l.scroll, 1),
        );
        glow
          .setTint(color)
          .setBlendMode('ADD')
          .setScale(2.4, 2.4 + h / 60)
          .setAlpha(0.45)
          .setDepth(DEPTH.background + 3);
        this.flames.push(glow);
      } else {
        g.fillStyle(0x0b0c18, 1);
        g.fillRect(x - 4, floor - 240, 8, 240);
        g.fillRect(x - 4, floor - 240, 40, 6);
        g.fillStyle(l.color, 1);
        g.fillRect(x + 22, floor - 236, 18, 6);
        const glow = this.addObj(
          s.add.image(x + 31, floor - 228, TEXTURES.glow).setScrollFactor(l.scroll, 1),
        );
        glow
          .setTint(l.color)
          .setBlendMode('ADD')
          .setScale(2.2)
          .setAlpha(0.6)
          .setDepth(DEPTH.background + 3);
        this.flames.push(glow);
      }
    }
    // Subtle flicker (one tween for all lights). Signs and lamps only pulse in opacity.
    const fire = l.kind === 'torches' || l.kind === 'braziers';
    s.tweens.add({
      targets: this.flames,
      alpha: { from: 0.65, to: 1 },
      ...(fire ? { scale: l.kind === 'torches' ? { from: 1.2, to: 1.55 } : { from: 1.6, to: 2 } } : {}),
      duration: fire ? 170 : l.kind === 'signs' ? 900 : 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private ambient(): void {
    const s = this.scene;
    const q = QUALITY_PRESETS[this.quality];
    const a = this.arena;
    if (a.ambient === 'ash') {
      this.addObj(
        s.add
          .particles(0, 0, TEXTURES.ember, {
            x: { min: -100, max: a.width + 100 },
            y: -20,
            lifespan: 9000,
            speedY: { min: 25, max: 60 },
            speedX: { min: -30, max: 10 },
            rotate: { min: 0, max: 360 },
            scale: { start: 0.9, end: 0.5 },
            alpha: { start: 0.7, end: 0 },
            tint: [a.ambientColor, 0x8a8078],
            frequency: Math.round(9000 / q.ambientParticles),
          })
          .setDepth(DEPTH.vfx - 1),
      );
      return;
    }
    if (a.ambient === 'rain') {
      this.addObj(
        s.add
          .particles(0, 0, TEXTURES.rain, {
            x: { min: -200, max: a.width + 200 },
            y: -40,
            lifespan: 1100,
            speedY: { min: 900, max: 1200 },
            speedX: -180,
            rotate: 10,
            alpha: { start: 0.45, end: 0.1 },
            tint: a.ambientColor,
            quantity: Math.max(1, Math.round(q.ambientParticles / 12)),
            frequency: 30,
          })
          .setDepth(DEPTH.vfx - 1),
      );
    } else {
      this.addObj(
        s.add
          .particles(0, 0, TEXTURES.ember, {
            x: { min: 0, max: a.width },
            y: a.floorY + 20,
            lifespan: 6000,
            speedY: { min: -70, max: -30 },
            speedX: { min: -20, max: 20 },
            scale: { start: 1, end: 0.2 },
            alpha: { start: 0.9, end: 0 },
            tint: [a.ambientColor, 0xffe2a0],
            frequency: Math.round(7000 / q.ambientParticles),
            blendMode: 'ADD',
          })
          .setDepth(DEPTH.background + 4),
      );
    }
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.flames = [];
  }
}
