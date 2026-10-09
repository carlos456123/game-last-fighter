import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import type { FighterData } from '@/types';
import { drawIcon } from './Icons';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { registerTestTarget, unregisterTestTarget } from './TestTargets';

export const CARD_W = 200;
export const CARD_H = 196;

/** Roster card: live mini fighter, name, archetype, selected frame and a clear locked state. */
export class CharacterCard extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly renderer: FighterRenderer;
  private readonly lockLayer: Phaser.GameObjects.Container;
  private selected = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly fighter: FighterData,
    name: string,
    archetype: string,
    readonly locked: boolean,
    lockReason: string,
    onPick: () => void,
  ) {
    super(scene, x, y);
    this.frame = scene.add.graphics();
    this.add(this.frame);
    this.renderer = new FighterRenderer(scene, fighter, 0.62);
    if (locked) {
      // Locked fighters are shown as a dark silhouette so the shape still teases who they are.
      this.renderer.setPalette({
        primary: 0x0d0b14,
        secondary: 0x0d0b14,
        accent: 0x15121e,
        skin: 0x0d0b14,
        hair: 0x0d0b14,
        outline: 0x2a2438,
        energy: 0x2a2438,
      });
    }
    const nameText = scene.add
      .text(0, CARD_H / 2 - 44, name, textStyle({ font: 'display', size: TYPE.body }))
      .setOrigin(0.5);
    const archText = scene.add
      .text(0, CARD_H / 2 - 18, archetype, textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }))
      .setOrigin(0.5);
    this.add([nameText, archText]);
    const lockIcon = scene.add.graphics();
    lockIcon.fillStyle(COLORS.bg, 0.82);
    lockIcon.fillRoundedRect(-CARD_W / 2 + 10, -64, CARD_W - 20, 96, 8);
    drawIcon(lockIcon, 'lock', 0, -36, 34, COLORS.gold);
    const lockText = scene.add
      .text(
        0,
        6,
        lockReason,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.gold, align: 'center', wrap: CARD_W - 30 }),
      )
      .setOrigin(0.5);
    // Separate top-level container so it renders above the fighter silhouette.
    this.lockLayer = scene.add
      .container(x, y - 8, [lockIcon, lockText])
      .setVisible(locked)
      .setDepth(3);
    if (locked) nameText.setColor(TEXT_COLORS.muted);
    this.setSize(CARD_W, CARD_H);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerup', onPick);
    scene.add.existing(this);
    const id = `card-${fighter.id}`;
    registerTestTarget(scene, id, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      unregisterTestTarget(scene, id);
      this.renderer.destroy();
      this.lockLayer.destroy();
    });
    this.drawFrame();
  }

  get enabled(): boolean {
    return !this.locked;
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.drawFrame();
  }

  tick(clock: number): void {
    // Selected card breathes; others hold a still guard.
    this.renderer.drawAnimation(this.x, this.y + 30, 1, 'idle', this.selected ? clock / 40 : 0.3, clock);
    this.renderer.setDepth(this.depth + 1);
    this.lockLayer.setPosition(this.x, this.y - 8);
  }

  private drawFrame(): void {
    const g = this.frame;
    const p = this.fighter.palette;
    g.clear();
    g.fillStyle(this.selected ? COLORS.panelHi : COLORS.panel, 0.95);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    g.fillStyle(this.locked ? COLORS.line : p.primary, this.selected ? 0.5 : 0.22);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H * 0.62, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.lineStyle(this.selected ? 4 : 2, this.selected ? COLORS.accent : COLORS.line, 1);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    if (this.selected) {
      g.fillStyle(COLORS.accent, 1);
      g.fillTriangle(-12, -CARD_H / 2 - 16, 12, -CARD_H / 2 - 16, 0, -CARD_H / 2 - 4);
    }
  }
}
