import Phaser from 'phaser';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { drawIcon } from './Icons';

const SEGMENTS = 4;

/** Energy gauge split in 4 segments (25 each). Full bar shows text, icon glow and pulse. */
export class EnergyBar extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly value: Phaser.GameObjects.Text;
  private readonly ready: Phaser.GameObjects.Text;
  private ratio = 0;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly barW: number,
    private readonly mirrored: boolean,
    readyLabel: string,
  ) {
    super(scene, x, y);
    this.bar = scene.add.graphics();
    this.icon = scene.add.graphics();
    const dir = mirrored ? -1 : 1;
    this.value = scene.add
      .text(dir * (barW + 34), 0, '0', textStyle({ size: TYPE.small, bold: true, color: TEXT_COLORS.dim }))
      .setOrigin(mirrored ? 1 : 0, 0.5);
    this.ready = scene.add
      .text(
        dir * (barW + 80),
        0,
        readyLabel,
        textStyle({ font: 'display', size: TYPE.tiny, color: TEXT_COLORS.gold, stroke: true }),
      )
      .setOrigin(mirrored ? 1 : 0, 0.5)
      .setVisible(false);
    this.add([this.bar, this.icon, this.value, this.ready]);
    scene.add.existing(this);
  }

  setValue(energy: number, max: number): void {
    this.ratio = Phaser.Math.Clamp(energy / max, 0, 1);
    this.value.setText(String(Math.floor(energy)));
  }

  tick(dt: number): void {
    this.time += dt;
    const g = this.bar;
    const dir = this.mirrored ? -1 : 1;
    const h = 14;
    const full = this.ratio >= 1;
    const x0 = dir * 22;
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRect(Math.min(x0, x0 + dir * this.barW) - 3, -h / 2 - 3, this.barW + 6, h + 6);
    g.fillStyle(COLORS.panelHi, 1);
    g.fillRect(Math.min(x0, x0 + dir * this.barW), -h / 2, this.barW, h);
    const fillW = this.barW * this.ratio;
    const color = full ? COLORS.energyFull : COLORS.energy;
    g.fillStyle(color, full ? 0.75 + Math.sin(this.time * 8) * 0.25 : 1);
    g.fillRect(dir === 1 ? x0 : x0 - fillW, -h / 2, fillW, h);
    g.lineStyle(2, 0x000000, 0.8);
    for (let i = 1; i < SEGMENTS; i++) {
      const sx = x0 + (dir * (this.barW * i)) / SEGMENTS;
      g.lineBetween(sx, -h / 2, sx, h / 2);
    }
    this.icon.clear();
    drawIcon(this.icon, 'energy', 0, 0, 24, full ? COLORS.energyFull : COLORS.energy);
    this.ready.setVisible(full);
    this.value.setColor(full ? TEXT_COLORS.gold : TEXT_COLORS.dim);
  }
}
