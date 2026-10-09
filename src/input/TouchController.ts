import type { ButtonState, FightButton } from '@/types';
import { createButtonState } from './InputFrame';

/** Button state fed by the on-screen virtual controls. Taps are latched like keyboard taps. */
export class TouchController {
  private held = createButtonState();
  private latched = createButtonState();

  set(button: FightButton, down: boolean): void {
    if (down && !this.held[button]) this.latched[button] = true;
    this.held[button] = down;
  }

  isDown(button: FightButton): boolean {
    return this.held[button];
  }

  sample(): ButtonState {
    const out = createButtonState();
    for (const key of Object.keys(out) as FightButton[]) out[key] = this.held[key] || this.latched[key];
    this.latched = createButtonState();
    return out;
  }

  reset(): void {
    this.held = createButtonState();
    this.latched = createButtonState();
  }
}
