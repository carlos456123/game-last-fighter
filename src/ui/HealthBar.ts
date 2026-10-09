import Phaser from 'phaser';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { drawIcon } from './Icons';

const LOW_HEALTH = 0.3;

/**
 * Slanted health bar with a delayed "damage taken" segment and 10% ticks. Low health is
 * communicated by colour, a warning icon, a text label and a pulse (never by colour alone).
 */
export class HealthBar extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly warn: Phaser.GameObjects.Container;
  private shown = 1;
  private trailing = 1;
  private target = 1;
  private pulse = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly barW: number,
    private readonly barH: number,
    /** Right-side bars drain towards the centre from the right. */
    private readonly mirrored: boolean,
    dangerLabel: string,
  ) {
    super(scene, x, y);
    this.bar = scene.add.graphics();
    const icon = scene.add.graphics();
    drawIcon(icon, 'health', 0, 0, 18, COLORS.danger);
    const label = scene.add
      .text(14, 0, dangerLabel, textStyle({ size: TYPE.tiny, bold: true, color: TEXT_COLORS.danger }))
      .setOrigin(0, 0.5);
    this.warn = scene.add.container(mirrored ? -250 : 160, this.barH + 18, [icon, label]).setVisible(false);
    this.add([this.bar, this.warn]);
    scene.add.existing(this);
    this.draw();
  }

  setRatio(ratio: number, instant = false): void {
    this.target = Phaser.Math.Clamp(ratio, 0, 1);
    if (instant) {
      this.shown = this.trailing = this.target;
      this.draw();
    }
  }

  tick(dt: number): void {
    this.shown = Phaser.Math.Linear(this.shown, this.target, Math.min(1, dt * 18));
    if (this.target > this.trailing) this.trailing = this.target;
    else this.trailing = Math.max(this.target, this.trailing - dt * 0.35);
    this.pulse += dt * 6;
    this.draw();
  }

  private draw(): void {
    const g = this.bar;
    const w = this.barW;
    const h = this.barH;
    const s = 14;
    const dir = this.mirrored ? -1 : 1;
    g.clear();
    const shape = (fromRatio: number, toRatio: number, color: number, alpha: number): void => {
      if (toRatio <= fromRatio) return;
      const x0 = fromRatio * w;
      const x1 = toRatio * w;
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(dir * (x0 + s), 0);
      g.lineTo(dir * (x1 + s), 0);
      g.lineTo(dir * x1, h);
      g.lineTo(dir * x0, h);
      g.closePath();
      g.fillPath();
    };
    // Frame
    g.fillStyle(0x000000, 0.6);
    g.beginPath();
    g.moveTo(dir * -4, -5);
    g.lineTo(dir * (w + s + 6), -5);
    g.lineTo(dir * (w + 4), h + 5);
    g.lineTo(dir * -10, h + 5);
    g.closePath();
    g.fillPath();
    shape(0, 1, COLORS.panelHi, 1);
    // Bars drain from the outer edge towards the centre of the screen.
    const low = this.target <= LOW_HEALTH;
    const color = low ? COLORS.danger : this.target < 0.6 ? COLORS.gold : COLORS.success;
    shape(1 - this.trailing, 1, 0xffffff, 0.85);
    const alpha = low ? 0.7 + Math.sin(this.pulse) * 0.3 : 1;
    shape(1 - this.shown, 1, color, alpha);
    // Highlight strip
    shape(1 - this.shown, 1, 0xffffff, 0.12);
    // 10% ticks
    g.lineStyle(2, 0x000000, 0.45);
    for (let i = 1; i < 10; i++) {
      const tx = (i / 10) * w;
      g.lineBetween(dir * (tx + s), 0, dir * tx, h);
    }
    this.warn.setVisible(low && this.target > 0);
  }
}
