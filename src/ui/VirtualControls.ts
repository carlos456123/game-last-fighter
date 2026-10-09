import Phaser from 'phaser';
import { GAME_HEIGHT } from '@/config/gameConfig';
import type { Character } from '@/characters/Character';
import type { TouchController } from '@/input/TouchController';
import type { FightButton, MoveSlot } from '@/types';
import { drawIcon, type IconKind } from './Icons';
import { COLORS, DEPTH, TYPE, textStyle } from './theme';
import { registerTestTarget, unregisterTestTarget } from './TestTargets';

interface PadButton {
  id: string;
  button: FightButton | 'dodge';
  x: number;
  y: number;
  r: number;
  icon: IconKind;
  label: string;
  slot?: MoveSlot;
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  pointer: number | null;
  enabled: boolean;
}

const STICK_ZONE_X = 520;
const STICK_RADIUS = 78;
const DEAD = 0.32;

/**
 * On-screen joystick + action buttons for touch screens. Feeds the same TouchController the
 * InputManager reads, so touch and keyboard go through the exact same game logic.
 */
export class VirtualControls {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private stickPointer: number | null = null;
  private stickOrigin = { x: 170, y: GAME_HEIGHT - 150 };
  private readonly buttons: PadButton[];
  private dodgeFrames = 0;
  private dodgeDir: 'left' | 'right' = 'left';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly touch: TouchController,
    private readonly opacity: number,
    private readonly fighter: () => Character,
  ) {
    this.base = this.add(scene.add.graphics());
    this.knob = this.add(scene.add.graphics());
    const B = (
      id: string,
      button: PadButton['button'],
      x: number,
      y: number,
      r: number,
      icon: IconKind,
      label: string,
      slot?: MoveSlot,
    ) => {
      const g = this.add(scene.add.graphics());
      const text = this.add(
        scene.add
          .text(x, y + r * 0.55, label, textStyle({ font: 'display', size: TYPE.tiny, stroke: true }))
          .setOrigin(0.5),
      );
      const pb: PadButton = { id, button, x, y, r, icon, label, slot, g, text, pointer: null, enabled: true };
      registerTestTarget(scene, id, {
        get x() {
          return pb.x;
        },
        get y() {
          return pb.y;
        },
        visible: true,
        get enabled() {
          return pb.enabled;
        },
        getBounds: () => new Phaser.Geom.Rectangle(pb.x - pb.r, pb.y - pb.r, pb.r * 2, pb.r * 2),
      });
      return pb;
    };
    const bottom = GAME_HEIGHT;
    this.buttons = [
      B('touch-light', 'light', 1150, bottom - 118, 52, 'light', 'J'),
      B('touch-heavy', 'heavy', 1036, bottom - 76, 42, 'heavy', 'K'),
      B('touch-block', 'block', 1222, bottom - 238, 38, 'block', 'DEF'),
      B('touch-dodge', 'dodge', 1222, bottom - 332, 32, 'dodge', 'ESQ'),
      B('touch-skill', 'skill', 1034, bottom - 186, 36, 'projectile', 'L', 'skill'),
      B('touch-special', 'special', 1118, bottom - 250, 36, 'antiAir', 'U', 'special'),
      B('touch-ultimate', 'ultimate', 968, bottom - 290, 38, 'ultimate', 'I', 'ultimate'),
    ];
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => this.destroy());
    this.draw();
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as unknown as { setDepth: (d: number) => void }).setDepth(DEPTH.hud + 5);
    this.layer.add(o);
    return o;
  }

  setIcons(icons: Partial<Record<MoveSlot, IconKind>>): void {
    for (const b of this.buttons) if (b.slot && icons[b.slot]) b.icon = icons[b.slot] as IconKind;
    this.draw();
  }

  private hitButton(x: number, y: number): PadButton | undefined {
    return this.buttons.find((b) => Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r + 10);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const b = this.hitButton(p.x, p.y);
    if (b) {
      b.pointer = p.id;
      if (b.button === 'dodge') this.startDodge();
      else this.touch.set(b.button, true);
      this.draw();
      return;
    }
    if (p.x < STICK_ZONE_X && p.y > GAME_HEIGHT * 0.35 && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin = {
        x: Phaser.Math.Clamp(p.x, STICK_RADIUS + 20, STICK_ZONE_X - STICK_RADIUS),
        y: Phaser.Math.Clamp(p.y, GAME_HEIGHT * 0.45, GAME_HEIGHT - STICK_RADIUS - 16),
      };
      this.updateStick(p.x, p.y);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) this.updateStick(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      for (const d of ['left', 'right', 'up', 'down'] as const) this.touch.set(d, false);
      this.drawStick(0, 0);
    }
    for (const b of this.buttons) {
      if (b.pointer !== p.id) continue;
      b.pointer = null;
      if (b.button !== 'dodge') this.touch.set(b.button, false);
    }
    this.draw();
  }

  /** Dodge button = block tap + a direction (joystick direction, or away from the opponent). */
  private startDodge(): void {
    const f = this.fighter();
    const held = this.touch.isDown('left') ? 'left' : this.touch.isDown('right') ? 'right' : null;
    this.dodgeDir = held ?? (f.facing === 1 ? 'left' : 'right');
    this.touch.set(this.dodgeDir, true);
    this.touch.set('block', true);
    this.dodgeFrames = 4;
  }

  private updateStick(x: number, y: number): void {
    const dx = x - this.stickOrigin.x;
    const dy = y - this.stickOrigin.y;
    const len = Math.min(STICK_RADIUS, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const nx = (Math.cos(a) * len) / STICK_RADIUS;
    const ny = (Math.sin(a) * len) / STICK_RADIUS;
    this.touch.set('left', nx < -DEAD);
    this.touch.set('right', nx > DEAD);
    this.touch.set('up', ny < -0.55);
    this.touch.set('down', ny > 0.55);
    this.drawStick(nx, ny);
  }

  /** Called every frame: releases the timed dodge input and updates availability states. */
  update(): void {
    if (this.dodgeFrames > 0 && --this.dodgeFrames === 0) {
      this.touch.set(
        'block',
        this.buttons.some((b) => b.button === 'block' && b.pointer !== null),
      );
      if (this.stickPointer === null) this.touch.set(this.dodgeDir, false);
    }
    const f = this.fighter();
    let changed = false;
    for (const b of this.buttons) {
      if (!b.slot) continue;
      const m = f.moveForSlot(b.slot);
      const enabled = f.skills.cooldownOf(m.id) === 0 && f.energy >= m.energyCost;
      if (enabled !== b.enabled) {
        b.enabled = enabled;
        changed = true;
      }
    }
    if (changed) this.draw();
  }

  private drawStick(nx: number, ny: number): void {
    const o = this.stickOrigin;
    this.base.clear();
    this.base.fillStyle(COLORS.panel, this.opacity * 0.7);
    this.base.fillCircle(o.x, o.y, STICK_RADIUS);
    this.base.lineStyle(3, COLORS.lineHi, this.opacity);
    this.base.strokeCircle(o.x, o.y, STICK_RADIUS);
    this.knob.clear();
    this.knob.fillStyle(COLORS.white, Math.min(1, this.opacity + 0.2));
    this.knob.fillCircle(o.x + nx * STICK_RADIUS * 0.8, o.y + ny * STICK_RADIUS * 0.8, 34);
  }

  private draw(): void {
    this.drawStick(0, 0);
    for (const b of this.buttons) {
      const pressed = b.pointer !== null;
      const g = b.g;
      g.clear();
      g.fillStyle(pressed ? COLORS.accent : COLORS.panel, (pressed ? 0.9 : 0.6) * this.opacity + 0.15);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(
        3,
        b.enabled ? (b.button === 'ultimate' ? COLORS.energyFull : COLORS.lineHi) : COLORS.line,
        this.opacity + 0.2,
      );
      g.strokeCircle(b.x, b.y, b.r);
      drawIcon(g, b.icon, b.x, b.y - b.r * 0.15, b.r * 0.8, b.enabled ? COLORS.white : 0x5d566c);
      if (!b.enabled) {
        g.lineStyle(3, COLORS.danger, 0.8);
        g.lineBetween(b.x - b.r * 0.55, b.y + b.r * 0.55, b.x + b.r * 0.55, b.y - b.r * 0.55);
      }
      b.text.setAlpha(Math.min(1, this.opacity + 0.3));
    }
  }

  setVisible(v: boolean): void {
    this.base.setVisible(v);
    this.knob.setVisible(v);
    for (const b of this.buttons) {
      b.g.setVisible(v);
      b.text.setVisible(v);
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    for (const b of this.buttons) unregisterTestTarget(this.scene, b.id);
    this.touch.reset();
  }
}
