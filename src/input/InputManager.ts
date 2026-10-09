import type { ButtonState, InputFrame } from '@/types';
import { createButtonState, frameFromHeld } from './InputFrame';
import type { KeyboardController } from './KeyboardController';
import type { TouchController } from './TouchController';

/** Combines keyboard and touch into one InputFrame per simulation tick for the local player. */
export class InputManager {
  private previous: ButtonState = createButtonState();

  constructor(
    private readonly keyboard: KeyboardController,
    private readonly touch: TouchController,
  ) {}

  sample(): InputFrame {
    const held = this.keyboard.sample();
    const t = this.touch.sample();
    for (const k of Object.keys(held) as Array<keyof ButtonState>) held[k] ||= t[k];
    const frame = frameFromHeld(held, this.previous);
    this.previous = held;
    return frame;
  }

  /** Forget everything (after pause or scene changes) so no stale press fires. */
  reset(): void {
    this.previous = createButtonState();
    this.keyboard.reset();
    this.touch.reset();
  }
}
