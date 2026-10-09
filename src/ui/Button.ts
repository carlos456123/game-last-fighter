import Phaser from 'phaser';
import { getServices } from '@/systems/Services';
import { BUTTON, COLORS, TEXT_COLORS, TYPE, textStyle } from './theme';
import { registerTestTarget, unregisterTestTarget } from './TestTargets';

export type ButtonState = 'idle' | 'hover' | 'pressed' | 'disabled';
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonOptions {
  id: string;
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  variant?: ButtonVariant;
  fontSize?: number;
  /** Small text shown on the right (e.g. a key hint or a lock reason). */
  hint?: string;
  /** Left/right while focused (option cycling buttons). */
  onAdjust?: (direction: -1 | 1) => void;
}

/** Anything a MenuNavigator can move focus between. */
export interface Focusable {
  setFocused(focused: boolean): void;
  activate(): void;
  adjust?(direction: -1 | 1): void;
  readonly enabled: boolean;
  readonly visible: boolean;
}

/**
 * Game-styled button with idle/hover/pressed/disabled/focused states, sounds and an icon slot.
 * It is a real Phaser object (not HTML) and always triggers a real callback.
 */
export class Button extends Phaser.GameObjects.Container implements Focusable {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text | null;
  private readonly bw: number;
  private readonly bh: number;
  private readonly variant: ButtonVariant;
  private state_: ButtonState = 'idle';
  private focused = false;
  private selected = false;
  private armed = false;
  private _enabled = true;
  readonly id: string;
  private readonly onClick: () => void;
  private readonly onAdjust?: (direction: -1 | 1) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.id = options.id;
    this.onClick = options.onClick;
    this.onAdjust = options.onAdjust;
    this.bw = options.width ?? BUTTON.width;
    this.bh = options.height ?? BUTTON.height;
    this.variant = options.variant ?? 'primary';
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(
        0,
        0,
        options.label,
        textStyle({ font: 'display', size: options.fontSize ?? TYPE.h3 - 4, align: 'center' }),
      )
      .setOrigin(0.5);
    this.hintText = options.hint
      ? scene.add
          .text(this.bw / 2 - 16, 0, options.hint, textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }))
          .setOrigin(1, 0.5)
      : null;
    this.add([this.bg, this.text]);
    if (this.hintText) this.add(this.hintText);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.pointerOver());
    this.on('pointerout', (p: Phaser.Input.Pointer) => {
      // Dragging away with the button held cancels; a touch release (out before up) does not.
      if (p.isDown) this.armed = false;
      this.applyState(this._enabled ? 'idle' : 'disabled');
    });
    this.on('pointerdown', () => {
      this.armed = true;
      if (this._enabled) this.applyState('pressed');
    });
    this.on('pointerup', () => this.handleUp());
    scene.add.existing(this);
    this.redraw();
    registerTestTarget(scene, this.id, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => unregisterTestTarget(scene, this.id));
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get label(): string {
    return this.text.text;
  }

  setLabel(label: string): this {
    this.text.setText(label);
    return this;
  }

  setHint(hint: string): this {
    this.hintText?.setText(hint);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this._enabled = enabled;
    this.applyState(enabled ? 'idle' : 'disabled');
    return this;
  }

  /** Persistent "current option" state (e.g. the open tab), independent from focus. */
  setSelected(selected: boolean): this {
    this.selected = selected;
    this.redraw();
    return this;
  }

  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    if (focused) this.sound('ui_hover');
    this.redraw();
  }

  activate(): void {
    if (!this._enabled) {
      this.sound('ui_error');
      this.scene.tweens.add({ targets: this, x: this.x + 6, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    this.sound('ui_click');
    this.scene.tweens.add({ targets: this, scale: BUTTON.pressScale, duration: 60, yoyo: true });
    this.onClick();
  }

  adjust(direction: -1 | 1): void {
    if (!this.onAdjust || !this._enabled) return;
    this.sound('ui_click');
    this.onAdjust(direction);
  }

  private pointerOver(): void {
    if (!this._enabled) return;
    this.applyState('hover');
    this.sound('ui_hover');
  }

  private handleUp(): void {
    const wasArmed = this.armed;
    this.armed = false;
    this.applyState(this._enabled ? 'hover' : 'disabled');
    if (wasArmed) this.activate();
  }

  private sound(id: 'ui_hover' | 'ui_click' | 'ui_error'): void {
    getServices(this.scene).audio.play(id);
  }

  private applyState(state: ButtonState): void {
    this.state_ = state;
    this.redraw();
  }

  private redraw(): void {
    const g = this.bg;
    const w = this.bw;
    const h = this.bh;
    const active = this.state_ === 'hover' || this.state_ === 'pressed' || this.focused;
    const disabled = !this._enabled;
    const accent =
      this.variant === 'danger' ? COLORS.danger : this.variant === 'secondary' ? COLORS.cyan : COLORS.accent;
    const slant = 14;
    g.clear();
    // Drop shadow
    g.fillStyle(COLORS.shadow, 0.45);
    this.slantedRect(g, -w / 2 + 4, -h / 2 + 5, w, h, slant);
    // Body
    g.fillStyle(active ? COLORS.panelHi : COLORS.panel, disabled ? 0.6 : 0.94);
    this.slantedRect(g, -w / 2, -h / 2, w, h, slant);
    // Border
    g.lineStyle(2, active ? accent : COLORS.line, 1);
    this.slantedStroke(g, -w / 2, -h / 2, w, h, slant);
    // Accent bar on the left: thicker when focused (state is shown by shape, not only colour)
    g.fillStyle(accent, disabled ? 0.3 : 1);
    const barW = active ? 10 : 4;
    g.fillRect(-w / 2 + slant * 0.5, -h / 2 + 8, barW, h - 16);
    if (active && !disabled) {
      g.fillStyle(accent, 0.12);
      this.slantedRect(g, -w / 2, -h / 2, w, h, slant);
      // Focus chevron
      g.fillStyle(accent, 1);
      g.fillTriangle(-w / 2 - 22, -9, -w / 2 - 22, 9, -w / 2 - 8, 0);
    }
    if (this.selected) {
      g.fillStyle(COLORS.gold, 1);
      g.fillRect(-w / 2 + slant, h / 2 - 5, w - slant * 2, 4);
    }
    this.text.setColor(disabled ? TEXT_COLORS.muted : this.selected ? TEXT_COLORS.gold : TEXT_COLORS.primary);
    this.text.setX(active ? BUTTON.hoverShift / 2 : 0);
    this.setAlpha(disabled ? BUTTON.disabledAlpha + 0.3 : 1);
    this.setScale(this.state_ === 'pressed' ? BUTTON.pressScale : 1);
  }

  private slantedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    s: number,
  ): void {
    g.beginPath();
    g.moveTo(x + s, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w - s, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fillPath();
  }

  private slantedStroke(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    s: number,
  ): void {
    g.beginPath();
    g.moveTo(x + s, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w - s, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.strokePath();
  }
}
