import { COMBAT } from '@/config/gameConfig';
import { FIGHT_BUTTONS, type FightButton, type InputFrame } from '@/types';

interface BufferedPress {
  button: FightButton;
  frame: number;
  consumed: boolean;
}

/**
 * Keeps recent button presses for a few frames so fast inputs are not lost while
 * the fighter is still busy (combos, cancels, reversals). Also detects double taps.
 */
export class InputBuffer {
  private presses: BufferedPress[] = [];
  private lastTap: Partial<Record<FightButton, number>> = {};
  private doubleTapped = new Set<FightButton>();

  constructor(
    private readonly window: number = COMBAT.inputBufferFrames,
    private readonly doubleTapWindow: number = COMBAT.doubleTapFrames,
  ) {}

  push(frame: number, input: InputFrame): void {
    this.doubleTapped.clear();
    for (const button of FIGHT_BUTTONS) {
      if (!input.pressed[button]) continue;
      this.presses.push({ button, frame, consumed: false });
      const last = this.lastTap[button];
      if (last !== undefined && frame - last <= this.doubleTapWindow) {
        this.doubleTapped.add(button);
        this.lastTap[button] = undefined;
      } else {
        this.lastTap[button] = frame;
      }
    }
    const oldest = frame - this.window;
    if (this.presses.length > 0 && this.presses[0].frame < oldest) {
      this.presses = this.presses.filter((p) => p.frame >= oldest);
    }
  }

  /** True if the button was pressed within the buffer window and not yet used. */
  has(button: FightButton, frame: number): boolean {
    return this.presses.some((p) => p.button === button && !p.consumed && frame - p.frame <= this.window);
  }

  /** Consumes the most recent unconsumed press of the button. */
  consume(button: FightButton, frame: number): boolean {
    for (let i = this.presses.length - 1; i >= 0; i--) {
      const p = this.presses[i];
      if (p.button === button && !p.consumed && frame - p.frame <= this.window) {
        p.consumed = true;
        return true;
      }
    }
    return false;
  }

  /** True only on the tick the second tap happened. */
  wasDoubleTapped(button: FightButton): boolean {
    return this.doubleTapped.has(button);
  }

  clear(): void {
    this.presses = [];
    this.lastTap = {};
    this.doubleTapped.clear();
  }
}
