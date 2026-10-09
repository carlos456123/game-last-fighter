import Phaser from 'phaser';
import { FPS } from '@/config/gameConfig';
import type { Character } from '@/characters/Character';
import type { MoveData } from '@/types';
import { drawIcon, iconForMove } from './Icons';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';

export type SlotState = 'ready' | 'energy' | 'cooldown';

/**
 * HUD slot for a skill/ultimate: icon, key, cost, and a clear state (ready / not enough energy /
 * recharging with a radial sweep and seconds left).
 */
export class SkillSlot extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly keyText: Phaser.GameObjects.Text;
  private readonly cdText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private state_: SlotState = 'ready';
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly move: MoveData,
    keyLabel: string,
    private readonly size = 58,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.keyText = scene.add
      .text(
        -size / 2 + 4,
        -size / 2 + 2,
        keyLabel,
        textStyle({ font: 'display', size: TYPE.tiny, stroke: true }),
      )
      .setOrigin(0, 0);
    this.cdText = scene.add
      .text(0, 0, '', textStyle({ font: 'display', size: TYPE.small, stroke: true }))
      .setOrigin(0.5);
    this.costText = scene.add
      .text(
        0,
        size / 2 + 10,
        String(move.energyCost),
        textStyle({ size: TYPE.tiny, bold: true, color: TEXT_COLORS.dim }),
      )
      .setOrigin(0.5);
    this.add([this.g, this.keyText, this.cdText, this.costText]);
    scene.add.existing(this);
  }

  get slotState(): SlotState {
    return this.state_;
  }

  setKeyLabel(label: string): void {
    this.keyText.setText(label);
  }

  refresh(fighter: Character, dt: number): void {
    this.time += dt;
    const cd = fighter.skills.cooldownOf(this.move.id);
    const state: SlotState = cd > 0 ? 'cooldown' : fighter.energy < this.move.energyCost ? 'energy' : 'ready';
    this.state_ = state;
    const g = this.g;
    const s = this.size;
    const ult = this.move.kind === 'ultimate';
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6, 10);
    g.fillStyle(state === 'ready' ? COLORS.panelHi : COLORS.panel, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 8);
    const accent = ult ? COLORS.energyFull : COLORS.accent;
    const iconColor = state === 'ready' ? (ult ? COLORS.energyFull : COLORS.white) : 0x5d566c;
    drawIcon(g, iconForMove(this.move), 0, 2, s * 0.56, iconColor);
    if (state === 'ready') {
      const glow = ult ? 0.6 + Math.sin(this.time * 7) * 0.4 : 1;
      g.lineStyle(3, accent, glow);
      g.strokeRoundedRect(-s / 2, -s / 2, s, s, 8);
    } else {
      g.lineStyle(2, COLORS.line, 1);
      g.strokeRoundedRect(-s / 2, -s / 2, s, s, 8);
    }
    if (state === 'cooldown') {
      const ratio = cd / Math.max(1, this.move.cooldown);
      g.fillStyle(0x000000, 0.55);
      g.slice(0, 0, s * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.fillPath();
      this.cdText.setText((cd / FPS).toFixed(1)).setVisible(true);
    } else {
      this.cdText.setVisible(false);
    }
    if (state === 'energy') {
      // Diagonal slash = unavailable, works without colour perception.
      g.lineStyle(3, COLORS.danger, 0.9);
      g.lineBetween(-s / 2 + 8, s / 2 - 8, s / 2 - 8, -s / 2 + 8);
    }
    this.costText.setColor(state === 'energy' ? TEXT_COLORS.danger : TEXT_COLORS.dim);
    this.setAlpha(state === 'ready' ? 1 : 0.85);
  }
}
