import type Phaser from 'phaser';
import type { Character } from '@/characters/Character';
import type { FighterData, Facing, Palette } from '@/types';
import { COLORS } from '@/ui/theme';
import { selectAnimation } from './AnimationRegistry';
import { samplePose, type Pose } from './PoseLibrary';
import { solveSkeleton, type Skeleton, type Vec } from './Skeleton';

export interface RenderFlags {
  flash: number;
  flicker: boolean;
  armor: boolean;
  stunned: boolean;
  alpha: number;
  /** Weapons point forward while attacking, reverse grip otherwise. */
  attacking: boolean;
}

const NO_FLAGS: RenderFlags = {
  flash: 0,
  flicker: false,
  armor: false,
  stunned: false,
  alpha: 1,
  attacking: false,
};

interface Ghost {
  sk: Skeleton;
  x: number;
  y: number;
  facing: Facing;
  life: number;
}

/** Blends two 0xRRGGBB colours without allocating (called many times per frame). */
const mix = (a: number, b: number, t: number): number => {
  const ch = (shift: number): number => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
};

const shade = (c: number, f: number): number => mix(c, 0x000000, 1 - f);

/**
 * Draws a fighter from its procedural skeleton every frame with Phaser Graphics.
 * The silhouette, costume and accessories all come from FighterData, so each fighter is
 * recognisable by shape alone. Final spritesheets can replace this renderer later without
 * touching the simulation (see PENDING_ASSETS.md).
 */
export class FighterRenderer {
  readonly g: Phaser.GameObjects.Graphics;
  private readonly ghostLayer: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private ghosts: Ghost[] = [];
  private palette: Palette;
  private scale: number;
  private sx = 0;
  private sy = 0;
  private facing: Facing = 1;
  private outline = 0;
  private time = 0;
  private attacking = false;
  /** World positions of interesting points from the last draw (for VFX anchors). */
  readonly anchors = { handF: { x: 0, y: 0 }, head: { x: 0, y: 0 }, chest: { x: 0, y: 0 } };

  constructor(
    scene: Phaser.Scene,
    readonly data: FighterData,
    scale = 1,
  ) {
    this.palette = data.palette;
    this.scale = scale;
    this.shadow = scene.add.graphics();
    this.ghostLayer = scene.add.graphics();
    this.g = scene.add.graphics();
  }

  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.shadow, this.ghostLayer, this.g];
  }

  setDepth(depth: number): this {
    this.shadow.setDepth(depth - 2);
    this.ghostLayer.setDepth(depth - 1);
    this.g.setDepth(depth);
    return this;
  }

  setScale(scale: number): void {
    this.scale = scale;
  }

  setPalette(palette: Palette): void {
    this.palette = palette;
  }

  setVisible(v: boolean): void {
    for (const o of [this.shadow, this.ghostLayer, this.g]) o.setVisible(v);
  }

  destroy(): void {
    this.shadow.destroy();
    this.ghostLayer.destroy();
    this.g.destroy();
  }

  /** Draws the fighter from simulation state. `floorY` is the screen Y of the arena floor. */
  drawCharacter(c: Character, floorY: number, clock: number, trails: boolean, reduceFlashes: boolean): void {
    const anim = selectAnimation(c, clock);
    const pose = samplePose(anim.name, anim.t);
    const invuln =
      c.isInvulnerable() && (c.state === 'IDLE' || c.state === 'KNOCKDOWN' || c.state === 'DODGE');
    const teleporting = c.move?.teleport && Math.abs(c.moveFrame - c.move.teleport.atFrame) < 3;
    const flags: RenderFlags = {
      flash: c.flashFrames > 0 ? (reduceFlashes ? 0.3 : 0.75) : 0,
      flicker: invuln && Math.floor(clock / 3) % 2 === 0,
      armor: c.hasArmor(),
      stunned: c.state === 'STUN',
      alpha: teleporting ? 0.25 : 1,
      attacking: c.move !== null,
    };
    const wantsTrail =
      trails &&
      (c.state === 'DODGE' ||
        c.state === 'RUN' ||
        c.state === 'ULTIMATE' ||
        c.lockActive ||
        !!c.move?.movement);
    this.draw(c.x, floorY - c.y, c.facing, pose, clock, flags, wantsTrail);
    this.drawShadow(c.x, floorY, c.y);
  }

  /** Draws an arbitrary pose (menus, character select, tutorial demos). */
  drawPose(
    x: number,
    baseY: number,
    facing: Facing,
    pose: Pose,
    clock: number,
    flags: RenderFlags = NO_FLAGS,
  ): void {
    this.draw(x, baseY, facing, pose, clock, flags, false);
    this.drawShadow(x, baseY, 0);
  }

  drawAnimation(
    x: number,
    baseY: number,
    facing: Facing,
    name: string,
    t: number,
    clock: number,
    attacking = false,
  ): void {
    this.drawPose(x, baseY, facing, samplePose(name, t), clock, { ...NO_FLAGS, attacking });
  }

  private drawShadow(x: number, floorY: number, height: number): void {
    const s = this.shadow;
    s.clear();
    const w = this.data.body.width * 1.4 * this.scale * Math.max(0.4, 1 - height / 400);
    s.fillStyle(0x000000, 0.38);
    s.fillEllipse(x, floorY + 2, w, w * 0.22);
  }

  private draw(
    x: number,
    baseY: number,
    facing: Facing,
    pose: Pose,
    clock: number,
    flags: RenderFlags,
    trail: boolean,
  ): void {
    const sk = solveSkeleton(this.data.body, pose);
    this.time = clock;
    this.updateGhosts(sk, x, baseY, facing, trail);
    this.sx = x;
    this.sy = baseY;
    this.facing = facing;
    const g = this.g;
    g.clear();
    g.setAlpha(flags.flicker ? 0.5 : flags.alpha);
    this.outline = flags.armor ? COLORS.gold : this.palette.outline;
    this.attacking = flags.attacking;
    const tint = (c: number): number => (flags.flash > 0 ? mix(c, 0xffffff, flags.flash) : c);
    this.drawBody(sk, tint);
    if (flags.stunned) this.drawStunStars(sk);
    this.anchors.handF = this.w(sk.handF);
    this.anchors.head = this.w(sk.head);
    this.anchors.chest = this.w({ x: (sk.neck.x + sk.hip.x) / 2, y: (sk.neck.y + sk.hip.y) / 2 });
  }

  /** Local (facing right, y up) to world. */
  private w(p: Vec): Vec {
    return { x: this.sx + p.x * this.facing * this.scale, y: this.sy - p.y * this.scale };
  }

  private limb(a: Vec, b: Vec, width: number, color: number): void {
    const g = this.g;
    const pa = this.w(a);
    const pb = this.w(b);
    const wd = width * this.scale;
    const ow = wd + 5 * this.scale;
    g.lineStyle(ow, this.outline, 1);
    g.lineBetween(pa.x, pa.y, pb.x, pb.y);
    g.fillStyle(this.outline, 1);
    g.fillCircle(pa.x, pa.y, ow / 2);
    g.fillCircle(pb.x, pb.y, ow / 2);
    g.lineStyle(wd, color, 1);
    g.lineBetween(pa.x, pa.y, pb.x, pb.y);
    g.fillStyle(color, 1);
    g.fillCircle(pa.x, pa.y, wd / 2);
    g.fillCircle(pb.x, pb.y, wd / 2);
  }

  private circle(p: Vec, r: number, color: number, outline = true): void {
    const g = this.g;
    const wp = this.w(p);
    if (outline) {
      g.fillStyle(this.outline, 1);
      g.fillCircle(wp.x, wp.y, (r + 2.5) * this.scale);
    }
    g.fillStyle(color, 1);
    g.fillCircle(wp.x, wp.y, r * this.scale);
  }

  private poly(points: Vec[], color: number, outline = true): void {
    const g = this.g;
    const wp = points.map((p) => this.w(p));
    const trace = (): void => {
      g.beginPath();
      g.moveTo(wp[0].x, wp[0].y);
      for (let i = 1; i < wp.length; i++) g.lineTo(wp[i].x, wp[i].y);
      g.closePath();
    };
    if (outline) {
      g.lineStyle(5 * this.scale, this.outline, 1);
      trace();
      g.strokePath();
    }
    g.fillStyle(color, 1);
    trace();
    g.fillPath();
  }

  private add(p: Vec, d: Vec, k: number): Vec {
    return { x: p.x + d.x * k, y: p.y + d.y * k };
  }

  private drawBody(sk: Skeleton, tint: (c: number) => number): void {
    const b = this.data.body;
    const p = this.palette;
    const f = new Set(b.features);
    const t = b.limbThickness;
    const armsCovered = f.has('hood');
    const armColor = tint(armsCovered ? p.secondary : p.skin);
    const backArm = tint(shade(armsCovered ? p.secondary : p.skin, 0.72));
    const legColor = tint(p.secondary);
    const backLeg = tint(shade(p.secondary, 0.7));

    // Far side first.
    if (f.has('scarf')) this.drawScarf(sk, tint);
    this.drawArm(sk.shoulderB, sk.elbowB, sk.handB, t, backArm, tint, true);
    this.drawLeg(sk.hipB, sk.kneeB, sk.footB, t, backLeg, tint);
    this.drawTorso(sk, tint);
    this.drawLeg(sk.hipF, sk.kneeF, sk.footF, t, legColor, tint);
    if (f.has('shoulderPads')) this.drawShoulderPads(sk, tint);
    this.drawHead(sk, tint);
    this.drawArm(sk.shoulderF, sk.elbowF, sk.handF, t, armColor, tint, false);
  }

  private drawLeg(
    hip: Vec,
    knee: Vec,
    foot: Vec,
    t: number,
    color: number,
    tint: (c: number) => number,
  ): void {
    this.limb(hip, knee, t * 1.2, color);
    this.limb(knee, foot, t * 1.05, color);
    // Boot: a short segment pointing forward from the ankle.
    const toe = { x: foot.x + t * 1.1, y: foot.y };
    this.limb(foot, toe, t * 0.9, tint(shade(this.palette.secondary, 0.45)));
  }

  private drawArm(
    shoulder: Vec,
    elbow: Vec,
    hand: Vec,
    t: number,
    color: number,
    tint: (c: number) => number,
    back: boolean,
  ): void {
    const f = this.data.body.features;
    const p = this.palette;
    this.limb(shoulder, elbow, t, color);
    this.limb(elbow, hand, t * 0.92, color);
    if (f.includes('wraps')) {
      const mid = { x: (elbow.x + hand.x) / 2, y: (elbow.y + hand.y) / 2 };
      this.limb(mid, hand, t * 0.95, tint(back ? shade(p.accent, 0.75) : p.accent));
    }
    if (f.includes('twinBlades')) {
      const dx = hand.x - elbow.x;
      const dy = hand.y - elbow.y;
      const len = Math.hypot(dx, dy) || 1;
      const dir = this.attacking ? 1 : -0.85;
      const tip = { x: hand.x + (dx / len) * 46 * dir, y: hand.y + (dy / len) * 46 * dir };
      const g = this.g;
      const a = this.w(hand);
      const bt = this.w(tip);
      g.lineStyle(6 * this.scale, this.outline, 1);
      g.lineBetween(a.x, a.y, bt.x, bt.y);
      g.lineStyle(3.5 * this.scale, tint(p.accent), 1);
      g.lineBetween(a.x, a.y, bt.x, bt.y);
      g.lineStyle(1.2 * this.scale, 0xffffff, 0.9);
      g.lineBetween(a.x, a.y, bt.x, bt.y);
    }
    const gauntlet = f.includes('gauntlets');
    const fistR = gauntlet ? t * 0.85 : t * 0.62;
    const fistColor = gauntlet
      ? tint(back ? shade(p.accent, 0.7) : p.accent)
      : tint(back ? shade(p.skin, 0.72) : p.skin);
    this.circle(hand, fistR, fistColor);
  }

  /** Shoulder armour sits on the outer shoulder and is drawn before the head so it never hides it. */
  private drawShoulderPads(sk: Skeleton, tint: (c: number) => number): void {
    const t = this.data.body.limbThickness;
    const p = this.palette;
    const back = this.add(this.add(sk.shoulderB, sk.up, -t * 0.25), sk.forward, -t * 0.2);
    const front = this.add(this.add(sk.shoulderF, sk.up, -t * 0.3), sk.forward, t * 0.15);
    this.circle(back, t * 0.78, tint(shade(p.accent, 0.62)));
    this.poly(
      [
        this.add(front, sk.up, t * 0.75),
        this.add(front, sk.forward, t * 0.85),
        this.add(front, sk.up, -t * 0.7),
        this.add(front, sk.forward, -t * 0.8),
      ],
      tint(shade(p.accent, 0.92)),
    );
  }

  private drawTorso(sk: Skeleton, tint: (c: number) => number): void {
    const b = this.data.body;
    const p = this.palette;
    const fw = sk.forward;
    const sw = b.shoulderWidth * 0.62;
    const hw = b.hipWidth * 0.6;
    const chestTop = this.add(sk.neck, sk.up, -b.limbThickness * 0.2);
    const pts = [
      this.add(chestTop, fw, sw),
      this.add(chestTop, fw, -sw * 0.9),
      this.add(sk.hip, fw, -hw),
      this.add(sk.hip, fw, hw),
    ];
    this.poly(pts, tint(p.primary));
    // Chest accent stripe (lapel / plate) for readability of facing direction.
    const stripeTop = this.add(chestTop, fw, sw * 0.55);
    const stripeBottom = this.add(sk.hip, fw, hw * 0.4);
    const g = this.g;
    const a = this.w(stripeTop);
    const bb = this.w(stripeBottom);
    g.lineStyle(3 * this.scale, tint(shade(p.primary, 0.6)), 1);
    g.lineBetween(a.x, a.y, bb.x, bb.y);
    if (b.features.includes('belt')) {
      const l = this.add(sk.hip, fw, -hw * 1.05);
      const r = this.add(sk.hip, fw, hw * 1.05);
      const lift = this.add(sk.hip, sk.up, 6);
      this.limb(this.add(l, sk.up, 6), this.add(r, sk.up, 6), 7, tint(p.accent));
      const tailStart = this.add(lift, fw, -hw);
      const sway = Math.sin(this.time * 0.15) * 4;
      this.limb(tailStart, { x: tailStart.x - 10 + sway, y: tailStart.y - 22 }, 4, tint(p.accent));
    }
  }

  private drawHead(sk: Skeleton, tint: (c: number) => number): void {
    const b = this.data.body;
    const p = this.palette;
    const f = new Set(b.features);
    const r = sk.headR;
    const h = sk.head;
    const fw = sk.forward;
    const up = sk.up;
    // Neck
    this.limb(
      sk.neck,
      this.add(h, up, -r * 0.6),
      b.limbThickness * 0.8,
      tint(f.has('hood') ? p.secondary : p.skin),
    );
    if (f.has('hood')) {
      const back = this.add(this.add(h, fw, -r * 1.25), up, -r * 0.2);
      const tip = this.add(this.add(h, fw, -r * 2.1), up, -r * 0.9);
      this.poly([this.add(h, up, r * 1.05), back, tip, this.add(h, fw, -r * 0.5)], tint(p.primary));
      this.circle(h, r * 1.12, tint(p.primary));
      this.circle(this.add(h, fw, r * 0.35), r * 0.72, tint(shade(p.skin, 0.9)), false);
      if (f.has('mask')) {
        const m1 = this.add(this.add(h, fw, r * 0.95), up, -r * 0.05);
        const m2 = this.add(this.add(h, fw, -r * 0.1), up, -r * 0.5);
        this.limb(m1, m2, r * 0.75, tint(p.secondary));
      }
      this.drawEye(h, r, fw, up, tint(p.accent), true);
      return;
    }
    this.circle(h, r, tint(p.skin));
    if (f.has('hairSpikes')) {
      for (let i = 0; i < 3; i++) {
        const base = this.add(this.add(h, up, r * (0.85 - i * 0.35)), fw, -r * (0.2 + i * 0.35));
        const tip = this.add(this.add(base, fw, -r * 1.1), up, r * (0.6 - i * 0.25));
        const side = this.add(base, up, -r * 0.55);
        this.poly([base, tip, side], tint(p.hair));
      }
      this.poly(
        [this.add(h, up, r * 1.05), this.add(this.add(h, fw, -r), up, r * 0.4), this.add(h, fw, r * 0.6)],
        tint(p.hair),
        false,
      );
    }
    if (f.has('headband')) {
      const front = this.add(this.add(h, fw, r * 0.95), up, r * 0.35);
      const back = this.add(this.add(h, fw, -r * 0.95), up, r * 0.2);
      this.limb(front, back, r * 0.38, tint(p.primary));
      const wave = Math.sin(this.time * 0.18);
      const t1 = { x: back.x - r * 1.6, y: back.y - r * 0.4 + wave * 4 };
      const t2 = { x: t1.x - r * 1.2, y: t1.y - r * 0.5 - wave * 5 };
      this.limb(back, t1, r * 0.28, tint(p.primary));
      this.limb(t1, t2, r * 0.22, tint(p.primary));
    }
    if (f.has('beard')) {
      const chinA = this.add(this.add(h, fw, r * 0.95), up, -r * 0.1);
      const chinB = this.add(this.add(h, fw, r * 0.4), up, -r * 1.25);
      const jaw = this.add(this.add(h, fw, -r * 0.5), up, -r * 0.55);
      this.poly([chinA, chinB, jaw], tint(p.hair));
    }
    this.drawEye(h, r, fw, up, tint(0x15101a), false);
  }

  private drawEye(h: Vec, r: number, fw: Vec, up: Vec, color: number, glow: boolean): void {
    const e1 = this.w(this.add(this.add(h, fw, r * 0.55), up, r * 0.15));
    const e2 = this.w(this.add(this.add(h, fw, r * 0.95), up, r * 0.2));
    const g = this.g;
    if (glow) {
      g.lineStyle(5 * this.scale, color, 0.35);
      g.lineBetween(e1.x, e1.y, e2.x, e2.y);
    }
    g.lineStyle(2.5 * this.scale, color, 1);
    g.lineBetween(e1.x, e1.y, e2.x, e2.y);
  }

  private drawScarf(sk: Skeleton, tint: (c: number) => number): void {
    const p = this.palette;
    const base = this.add(sk.neck, sk.forward, -4);
    let prev = base;
    for (let i = 1; i <= 4; i++) {
      const wave = Math.sin(this.time * 0.2 - i * 0.9) * (3 + i * 2);
      const next = { x: base.x - i * 15, y: base.y - i * 6 + wave };
      this.limb(prev, next, 9 - i, tint(i === 4 ? p.accent : p.primary));
      prev = next;
    }
  }

  private drawStunStars(sk: Skeleton): void {
    const g = this.g;
    const c = this.w(this.add(sk.head, sk.up, sk.headR * 1.6));
    for (let i = 0; i < 3; i++) {
      const a = this.time * 0.12 + (i * Math.PI * 2) / 3;
      const x = c.x + Math.cos(a) * 26 * this.scale;
      const y = c.y + Math.sin(a) * 8 * this.scale;
      g.fillStyle(COLORS.gold, 1);
      g.fillTriangle(x, y - 7, x + 6, y + 5, x - 6, y + 5);
      g.fillTriangle(x, y + 8, x + 6, y - 3, x - 6, y - 3);
    }
  }

  private updateGhosts(sk: Skeleton, x: number, y: number, facing: Facing, active: boolean): void {
    if (active && Math.floor(this.time) % 2 === 0) this.ghosts.push({ sk, x, y, facing, life: 1 });
    const g = this.ghostLayer;
    g.clear();
    const color = this.palette.energy;
    for (const ghost of this.ghosts) {
      ghost.life -= 0.12;
      if (ghost.life <= 0) continue;
      const toW = (p: Vec): Vec => ({
        x: ghost.x + p.x * ghost.facing * this.scale,
        y: ghost.y - p.y * this.scale,
      });
      g.lineStyle(this.data.body.limbThickness * this.scale, color, ghost.life * 0.35);
      const s = ghost.sk;
      const segs: Array<[Vec, Vec]> = [
        [s.hip, s.neck],
        [s.shoulderF, s.elbowF],
        [s.elbowF, s.handF],
        [s.hipF, s.kneeF],
        [s.kneeF, s.footF],
        [s.hipB, s.kneeB],
        [s.kneeB, s.footB],
      ];
      for (const [a, b] of segs) {
        const pa = toW(a);
        const pb = toW(b);
        g.lineBetween(pa.x, pa.y, pb.x, pb.y);
      }
      const hd = toW(s.head);
      g.fillStyle(color, ghost.life * 0.3);
      g.fillCircle(hd.x, hd.y, s.headR * this.scale);
    }
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
    if (this.ghosts.length > 8) this.ghosts.splice(0, this.ghosts.length - 8);
  }
}
