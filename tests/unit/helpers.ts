import { Match, type MatchMode } from '@/core/Match';
import { COLOSSEUM } from '@/data/arenas';
import { getFighter } from '@/characters/CharacterFactory';
import { createButtonState, createInputFrame } from '@/input/InputFrame';
import type { FightButton, InputFrame } from '@/types';

export const makeMatch = (p1 = 'kael', p2 = 'kael', mode: MatchMode = 'versus'): Match =>
  new Match({ p1: getFighter(p1), p2: getFighter(p2), arena: COLOSSEUM, mode });

/** Builds an input frame holding and/or pressing the given buttons. */
export const input = (held: FightButton[] = [], pressed: FightButton[] = []): InputFrame => {
  const frame = { held: createButtonState(), pressed: createButtonState() };
  for (const b of held) frame.held[b] = true;
  for (const b of pressed) {
    frame.pressed[b] = true;
    frame.held[b] = true;
  }
  return frame;
};

export const idle = (): InputFrame => createInputFrame();

export const run = (
  match: Match,
  frames: number,
  p1: () => InputFrame = idle,
  p2: () => InputFrame = idle,
): void => {
  for (let i = 0; i < frames; i++) match.step(p1(), p2());
};

/** Skips the countdown so the fight is live. */
export const startFight = (match: Match): void => {
  let guard = 0;
  while (match.phase !== 'fight' && guard++ < 1000) match.step(idle(), idle());
};

/** Places both fighters at a given gap, facing each other. */
export const placeAt = (match: Match, gap: number): void => {
  const center = (match.bounds.left + match.bounds.right) / 2;
  match.p1.x = center - gap / 2;
  match.p2.x = center + gap / 2;
  match.p1.facing = 1;
  match.p2.facing = -1;
};
