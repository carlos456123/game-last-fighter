import type Phaser from 'phaser';
import { getServices } from '@/systems/Services';
import type { Focusable } from './Button';

export interface NavigatorOptions {
  onBack?: () => void;
  /** Horizontal layouts (character cards) use left/right to move instead of adjusting. */
  horizontal?: boolean;
  wrap?: boolean;
}

/**
 * Keyboard navigation for menus: arrows/WASD (and the player's bindings) move focus,
 * Enter/Space/light-attack confirms, Escape goes back. Mouse and touch keep working in parallel.
 */
export class MenuNavigator {
  private index = 0;
  private readonly unsubscribe: () => void;
  enabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private items: Focusable[],
    private readonly options: NavigatorOptions = {},
  ) {
    const { keyboard } = getServices(scene);
    this.unsubscribe = keyboard.onKey((code) => this.handle(code));
    scene.events.once('shutdown', () => this.unsubscribe());
    scene.events.once('destroy', () => this.unsubscribe());
    this.focus(this.firstEnabled());
  }

  setItems(items: Focusable[], keepIndex = false): void {
    for (const i of this.items) i.setFocused(false);
    this.items = items;
    this.focus(keepIndex ? Math.min(this.index, items.length - 1) : this.firstEnabled());
  }

  get focusedIndex(): number {
    return this.index;
  }

  focus(index: number): void {
    if (this.items.length === 0) return;
    this.items[this.index]?.setFocused(false);
    this.index = Math.max(0, Math.min(this.items.length - 1, index));
    this.items[this.index].setFocused(true);
  }

  private firstEnabled(): number {
    const i = this.items.findIndex((it) => it.enabled);
    return i < 0 ? 0 : i;
  }

  private move(delta: number): void {
    const n = this.items.length;
    if (n === 0) return;
    let next = this.index;
    for (let step = 0; step < n; step++) {
      next =
        this.options.wrap === false ? Math.max(0, Math.min(n - 1, next + delta)) : (next + delta + n) % n;
      if (this.items[next].visible) break;
    }
    this.focus(next);
  }

  private handle(code: string): void {
    if (!this.enabled || !this.scene.scene.isActive()) return;
    const { keyboard } = getServices(this.scene);
    const is = (action: Parameters<typeof keyboard.matches>[0], ...extra: string[]): boolean =>
      keyboard.matches(action, code) || extra.includes(code);
    const prevKeys = this.options.horizontal ? is('left', 'ArrowLeft') : is('up', 'ArrowUp');
    const nextKeys = this.options.horizontal ? is('right', 'ArrowRight') : is('down', 'ArrowDown');
    if (prevKeys) this.move(-1);
    else if (nextKeys) this.move(1);
    else if (!this.options.horizontal && is('left', 'ArrowLeft')) this.items[this.index]?.adjust?.(-1);
    else if (!this.options.horizontal && is('right', 'ArrowRight')) this.items[this.index]?.adjust?.(1);
    else if (code === 'Enter' || code === 'NumpadEnter' || is('light') || code === 'Space')
      this.items[this.index]?.activate();
    else if (code === 'Escape' || code === 'Backspace') {
      if (this.options.onBack) {
        getServices(this.scene).audio.play('ui_back');
        this.options.onBack();
      }
    }
  }

  destroy(): void {
    this.unsubscribe();
  }
}
