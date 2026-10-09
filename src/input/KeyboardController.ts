import { FIGHT_BUTTONS, type ActionId, type ButtonState, type ControlBindings } from '@/types';
import { createButtonState } from './InputFrame';

type KeyListener = (code: string, event: KeyboardEvent) => void;

/**
 * Tracks physical keys (by `KeyboardEvent.code`, so AZERTY/QWERTZ layouts still work) and maps
 * them to logical buttons through the configurable bindings. Taps shorter than one tick are
 * latched so they are never lost.
 */
export class KeyboardController {
  private down = new Set<string>();
  private latched = new Set<string>();
  private listeners = new Set<KeyListener>();
  private gameCodes = new Set<string>();
  private attached = false;

  constructor(private bindings: ControlBindings) {
    this.indexCodes();
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.reset);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.reset);
    this.attached = false;
  }

  setBindings(bindings: ControlBindings): void {
    this.bindings = bindings;
    this.indexCodes();
  }

  get currentBindings(): ControlBindings {
    return this.bindings;
  }

  /** Subscribe to raw key presses (menus, remapping). Returns an unsubscribe function. */
  onKey(listener: KeyListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** True if the key code belongs to the given action. */
  matches(action: ActionId, code: string): boolean {
    return this.bindings[action].includes(code);
  }

  isActionDown(action: ActionId): boolean {
    return this.bindings[action].some((c) => this.down.has(c) || this.latched.has(c));
  }

  /** Held state of all fight buttons; clears tap latches. */
  sample(): ButtonState {
    const state = createButtonState();
    for (const b of FIGHT_BUTTONS) state[b] = this.isActionDown(b);
    this.latched.clear();
    return state;
  }

  readonly reset = (): void => {
    this.down.clear();
    this.latched.clear();
  };

  private indexCodes(): void {
    this.gameCodes = new Set(Object.values(this.bindings).flat());
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.gameCodes.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.down.add(e.code);
    this.latched.add(e.code);
    for (const l of [...this.listeners]) l(e.code, e);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };
}
