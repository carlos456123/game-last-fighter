import type { Character } from '@/characters/Character';
import { createButtonState } from '@/input/InputFrame';
import type { InputFrame } from '@/types';

const ATTACK_EVERY = 150;

/**
 * Practice partner for the tutorial: stands still and throws a jab every few seconds when the
 * player is close, so blocking and dodging can be practised safely.
 */
export class TrainingDummy {
  private timer = ATTACK_EVERY;

  constructor(
    private readonly self: Character,
    private readonly opponent: Character,
  ) {}

  think(): InputFrame {
    const held = createButtonState();
    const pressed = createButtonState();
    const gap = Math.abs(this.self.x - this.opponent.x);
    this.timer--;
    if (this.timer <= 0 && gap < 180 && this.self.isNeutral) {
      pressed.light = true;
      held.light = true;
      this.timer = ATTACK_EVERY;
    }
    return { held, pressed };
  }
}
