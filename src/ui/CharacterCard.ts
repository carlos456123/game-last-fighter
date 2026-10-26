import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import type { FighterData, Palette } from '@/types';
import { drawIcon } from './Icons';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { registerTestTarget, unregisterTestTarget } from './TestTargets';

export const CARD_W = 128;
export const CARD_H = 128;

/** Dark silhouette palette for locked fighters: the shape still teases who they are. */
export const LOCKED_PALETTE: Palette = {
  primary: 0x0d0b14,
  secondary: 0x0d0b14,
  accent: 0x15121e,
  skin: 0x0d0b14,
  hair: 0x0d0b14,
  outline: 0x2a2438,
  energy: 0x2a2438,
};

export interface CardInfo {
  name: string;
  locked: boolean;
  /** Short progress text for locked fighters, e.g. "6/10". */
  progress: string;
  /** Mastery level 1..3 (0 hides the pips). */
  mastery: number;
}

/** Roster card: live mini fighter, name, mastery pips and a clear locked state (icon + progress). */
export class CharacterCard extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly renderer: FighterRenderer;
  private readonly overlay: Phaser.GameObjects.Container;
  private selected = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly fighter: FighterData,
    private readonly info: CardInfo,
    onPick: () => void,
  ) {
    super(scene, x, y);
    this.frame = scene.add.graphics();
    this.add(this.frame);
    this.renderer = new FighterRenderer(scene, fighter, 0.42);
    if (info.locked) this.renderer.setPalette(LOCKED_PALETTE);
    const nameText = scene.add
      .text(0, CARD_H / 2 - 14, info.name, textStyle({ font: 'display', size: TYPE.tiny, align: 'center' }))
      .setOrigin(0.5);
    if (info.locked) nameText.setColor(TEXT_COLORS.muted);
    this.add(nameText);
    // Lock badge and progress are a separate top-level container so they render above the silhouette.
    const badge = scene.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [badge];
    if (info.locked) {
      badge.fillStyle(COLORS.bg, 0.85);
      badge.fillRoundedRect(-30, -30, 60, 46, 8);
      drawIcon(badge, 'lock', 0, -14, 24, COLORS.gold);
      parts.push(
        scene.add
          .text(0, 6, info.progress, textStyle({ size: TYPE.tiny, bold: true, color: TEXT_COLORS.gold }))
          .setOrigin(0.5),
      );
    } else if (info.mastery > 0) {
      for (let i = 0; i < 3; i++) {
        const px = CARD_W / 2 - 34 + i * 12;
        badge.fillStyle(i < info.mastery ? COLORS.gold : COLORS.line, 1);
        badge.fillTriangle(px, -CARD_H / 2 + 6, px + 5, -CARD_H / 2 + 13, px - 5, -CARD_H / 2 + 13);
        badge.fillTriangle(px, -CARD_H / 2 + 20, px + 5, -CARD_H / 2 + 13, px - 5, -CARD_H / 2 + 13);
      }
    }
    this.overlay = scene.add.container(x, y, parts).setDepth(3);
    this.setSize(CARD_W, CARD_H);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerup', onPick);
    scene.add.existing(this);
    const id = `card-${fighter.id}`;
    registerTestTarget(scene, id, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      unregisterTestTarget(scene, id);
      this.renderer.destroy();
      this.overlay.destroy();
    });
    this.drawFrame();
  }

  get locked(): boolean {
    return this.info.locked;
  }

  get enabled(): boolean {
    return !this.info.locked;
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.drawFrame();
  }

  tick(clock: number): void {
    // Selected card breathes; others hold a still guard.
    this.renderer.drawAnimation(this.x, this.y + 36, 1, 'idle', this.selected ? clock / 40 : 0.3, clock);
    this.renderer.setDepth(this.depth + 1);
  }

  private drawFrame(): void {
    const g = this.frame;
    const p = this.fighter.palette;
    g.clear();
    g.fillStyle(this.selected ? COLORS.panelHi : COLORS.panel, 0.95);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    g.fillStyle(this.info.locked ? COLORS.line : p.primary, this.selected ? 0.45 : 0.2);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H * 0.7, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.lineStyle(this.selected ? 4 : 2, this.selected ? COLORS.accent : COLORS.line, 1);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
  }
}
