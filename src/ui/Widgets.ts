import Phaser from 'phaser';
import { getServices } from '@/systems/Services';
import type { Focusable } from './Button';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { registerTestTarget, unregisterTestTarget } from './TestTargets';

const ROW_W = 760;
const ROW_H = 52;

/**
 * Base for a settings row: label on the left, control on the right, a focus frame, and
 * mouse/touch support. Subclasses render their control and react to adjust/activate.
 */
abstract class Row extends Phaser.GameObjects.Container implements Focusable {
  protected readonly frame: Phaser.GameObjects.Graphics;
  protected readonly labelText: Phaser.GameObjects.Text;
  protected focused = false;
  readonly enabled = true;

  protected readonly rowH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, id: string, height: number = ROW_H) {
    super(scene, x, y);
    this.rowH = height;
    this.frame = scene.add.graphics();
    this.labelText = scene.add
      .text(-ROW_W / 2 + 24, 0, label, textStyle({ size: TYPE.body }))
      .setOrigin(0, 0.5);
    this.add([this.frame, this.labelText]);
    this.setSize(ROW_W, height);
    this.setInteractive({ useHandCursor: true });
    scene.add.existing(this);
    registerTestTarget(scene, id, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => unregisterTestTarget(scene, id));
    this.drawFrame();
  }

  setFocused(focused: boolean): void {
    if (focused && !this.focused) getServices(this.scene).audio.play('ui_hover');
    this.focused = focused;
    this.drawFrame();
  }

  abstract activate(): void;
  abstract adjust(direction: -1 | 1): void;

  protected click(): void {
    getServices(this.scene).audio.play('ui_click');
  }

  protected drawFrame(): void {
    const g = this.frame;
    g.clear();
    g.fillStyle(this.focused ? COLORS.panelHi : COLORS.panel, this.focused ? 0.95 : 0.7);
    const h = this.rowH;
    g.fillRoundedRect(-ROW_W / 2, -h / 2, ROW_W, h, 6);
    if (this.focused) {
      g.lineStyle(2, COLORS.accent, 1);
      g.strokeRoundedRect(-ROW_W / 2, -h / 2, ROW_W, h, 6);
      g.fillStyle(COLORS.accent, 1);
      g.fillRect(-ROW_W / 2, -h / 2 + 8, 5, h - 16);
    }
  }
}

/** 0..1 slider with 10% steps; also shows the value as a number (not only a bar). */
export class Slider extends Row {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly trackX = 70;
  private readonly trackW = 220;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    id: string,
    private value: number,
    private readonly onChange: (v: number) => void,
  ) {
    super(scene, x, y, label, id);
    this.bar = scene.add.graphics();
    this.valueText = scene.add
      .text(ROW_W / 2 - 24, 0, '', textStyle({ size: TYPE.body, bold: true }))
      .setOrigin(1, 0.5);
    this.add([this.bar, this.valueText]);
    this.on('pointerdown', (p: Phaser.Input.Pointer) => this.setFromPointer(p));
    this.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && this.setFromPointer(p));
    this.render();
  }

  activate(): void {
    this.adjust(1);
  }

  adjust(direction: -1 | 1): void {
    this.set(Math.round((this.value + direction * 0.1) * 10) / 10);
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    const local = p.x - this.x;
    if (local < this.trackX - 10) return;
    this.set(Math.round(Phaser.Math.Clamp((local - this.trackX) / this.trackW, 0, 1) * 10) / 10);
  }

  private set(v: number): void {
    const clamped = Phaser.Math.Clamp(v, 0, 1);
    if (clamped === this.value) return;
    this.value = clamped;
    this.click();
    this.onChange(this.value);
    this.render();
  }

  private render(): void {
    const g = this.bar;
    g.clear();
    g.fillStyle(COLORS.line, 1);
    g.fillRoundedRect(this.trackX, -6, this.trackW, 12, 6);
    g.fillStyle(COLORS.accent, 1);
    g.fillRoundedRect(this.trackX, -6, Math.max(12, this.trackW * this.value), 12, 6);
    for (let i = 0; i <= 10; i++) {
      g.fillStyle(COLORS.bg, 0.6);
      g.fillRect(this.trackX + (this.trackW * i) / 10 - 1, -6, 2, 12);
    }
    g.fillStyle(COLORS.white, 1);
    g.fillCircle(this.trackX + this.trackW * this.value, 0, 11);
    this.valueText.setText(`${Math.round(this.value * 100)}%`);
  }
}

/** A row cycling through labelled options (also used for on/off toggles). */
export class Selector<T extends string | boolean> extends Row {
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly arrows: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    id: string,
    private readonly options: Array<{ value: T; label: string }>,
    private index: number,
    private readonly onChange: (v: T) => void,
  ) {
    super(scene, x, y, label, id);
    this.valueText = scene.add
      .text(ROW_W / 2 - 60, 0, '', textStyle({ size: TYPE.body, bold: true, color: TEXT_COLORS.gold }))
      .setOrigin(0.5);
    this.arrows = scene.add
      .text(ROW_W / 2 - 60, 0, '◀                ▶', textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }))
      .setOrigin(0.5);
    this.add([this.arrows, this.valueText]);
    this.on('pointerup', (p: Phaser.Input.Pointer) =>
      this.adjust(p.x - this.x < ROW_W / 2 - 60 && p.x - this.x > 0 ? -1 : 1),
    );
    this.render();
  }

  activate(): void {
    this.adjust(1);
  }

  adjust(direction: -1 | 1): void {
    if (this.options.length < 2) {
      getServices(this.scene).audio.play('ui_error');
      return;
    }
    this.index = (this.index + direction + this.options.length) % this.options.length;
    this.click();
    this.onChange(this.options[this.index].value);
    this.render();
  }

  private render(): void {
    const opt = this.options[this.index];
    // On/off states use a symbol as well as colour.
    const symbol = opt.value === true ? '● ' : opt.value === false ? '○ ' : '';
    this.valueText.setText(`${symbol}${opt.label}`);
    this.valueText.setColor(opt.value === false ? TEXT_COLORS.dim : TEXT_COLORS.gold);
  }
}

/** Key binding row: shows the current key, ENTER/click starts listening for a new key. */
export class KeyBindRow extends Row {
  private readonly keyText: Phaser.GameObjects.Text;
  private listening = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    id: string,
    keyLabel: string,
    private readonly onListen: (row: KeyBindRow) => void,
  ) {
    super(scene, x, y, label, id, 40);
    this.keyText = scene.add
      .text(ROW_W / 2 - 24, 0, keyLabel, textStyle({ font: 'display', size: TYPE.body }))
      .setOrigin(1, 0.5);
    this.add(this.keyText);
    this.on('pointerup', () => this.activate());
  }

  activate(): void {
    this.click();
    this.onListen(this);
  }

  adjust(): void {
    // Key rows have no left/right adjustment.
  }

  setListening(listening: boolean, waitingLabel: string): void {
    this.listening = listening;
    if (listening) this.keyText.setText(waitingLabel).setColor(TEXT_COLORS.gold);
    else this.keyText.setColor(TEXT_COLORS.primary);
  }

  setKey(label: string): void {
    this.keyText.setText(label).setColor(TEXT_COLORS.primary);
  }

  get isListening(): boolean {
    return this.listening;
  }
}

export const WIDGET_ROW = { width: ROW_W, height: ROW_H };
