import { FIGHT_BUTTONS, type ButtonState, type FightButton, type InputFrame } from '@/types';

export const createButtonState = (): ButtonState => {
  const state = {} as ButtonState;
  for (const b of FIGHT_BUTTONS) state[b] = false;
  return state;
};

export const createInputFrame = (): InputFrame => ({
  held: createButtonState(),
  pressed: createButtonState(),
});

/** Builds an InputFrame from held buttons, deriving `pressed` from the previous held state. */
export const frameFromHeld = (held: ButtonState, previousHeld: ButtonState): InputFrame => {
  const pressed = createButtonState();
  for (const b of FIGHT_BUTTONS) pressed[b] = held[b] && !previousHeld[b];
  return { held: { ...held }, pressed };
};

/** Combines several sources (keyboard + touch) into one frame. */
export const mergeFrames = (frames: InputFrame[]): InputFrame => {
  const out = createInputFrame();
  for (const f of frames) {
    for (const b of FIGHT_BUTTONS) {
      out.held[b] ||= f.held[b];
      out.pressed[b] ||= f.pressed[b];
    }
  }
  return out;
};

export const anyPressed = (frame: InputFrame, buttons: readonly FightButton[] = FIGHT_BUTTONS): boolean =>
  buttons.some((b) => frame.pressed[b]);
