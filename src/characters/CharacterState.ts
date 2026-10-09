/** Fighter state machine states. */
export const CharacterState = {
  IDLE: 'IDLE',
  WALK: 'WALK',
  RUN: 'RUN',
  JUMP: 'JUMP',
  FALL: 'FALL',
  CROUCH: 'CROUCH',
  ATTACK: 'ATTACK',
  BLOCK: 'BLOCK',
  DODGE: 'DODGE',
  HIT: 'HIT',
  STUN: 'STUN',
  KNOCKDOWN: 'KNOCKDOWN',
  SPECIAL: 'SPECIAL',
  ULTIMATE: 'ULTIMATE',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
} as const;
export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState];

const S = CharacterState;

/** States in which the fighter can freely choose a new action. */
export const NEUTRAL_STATES: ReadonlySet<CharacterState> = new Set([
  S.IDLE,
  S.WALK,
  S.RUN,
  S.CROUCH,
  S.BLOCK,
]);
export const AIR_STATES: ReadonlySet<CharacterState> = new Set([S.JUMP, S.FALL]);
export const MOVE_STATES: ReadonlySet<CharacterState> = new Set([S.ATTACK, S.SPECIAL, S.ULTIMATE]);
/** States in which further hits continue a combo. */
export const VULNERABLE_STATES: ReadonlySet<CharacterState> = new Set([S.HIT]);

const neutralTargets: CharacterState[] = [
  S.IDLE,
  S.WALK,
  S.RUN,
  S.JUMP,
  S.CROUCH,
  S.ATTACK,
  S.BLOCK,
  S.DODGE,
  S.HIT,
  S.SPECIAL,
  S.ULTIMATE,
  S.KNOCKDOWN,
  S.FALL,
];
const hurt: CharacterState[] = [S.HIT, S.KNOCKDOWN];

/**
 * Allowed transitions. Anything not listed is an impossible transition and is rejected.
 * VICTORY and DEFEAT are handled separately (round end can interrupt anything).
 */
const TRANSITIONS: Record<CharacterState, ReadonlySet<CharacterState>> = {
  IDLE: new Set(neutralTargets),
  WALK: new Set(neutralTargets),
  RUN: new Set(neutralTargets),
  CROUCH: new Set(neutralTargets),
  BLOCK: new Set(neutralTargets),
  JUMP: new Set([S.JUMP, S.FALL, S.ATTACK, S.SPECIAL, S.IDLE, S.CROUCH, ...hurt]),
  FALL: new Set([S.JUMP, S.FALL, S.ATTACK, S.SPECIAL, S.IDLE, S.CROUCH, ...hurt]),
  ATTACK: new Set([S.IDLE, S.CROUCH, S.FALL, S.ATTACK, S.SPECIAL, S.ULTIMATE, ...hurt]),
  SPECIAL: new Set([S.IDLE, S.CROUCH, S.FALL, S.ULTIMATE, ...hurt]),
  ULTIMATE: new Set([S.IDLE, S.CROUCH, S.FALL, ...hurt]),
  DODGE: new Set([S.IDLE, S.CROUCH, S.FALL, ...hurt]),
  HIT: new Set([S.IDLE, S.CROUCH, S.HIT, S.STUN, S.KNOCKDOWN, S.FALL]),
  STUN: new Set([S.IDLE, ...hurt]),
  KNOCKDOWN: new Set([S.IDLE]),
  VICTORY: new Set(),
  DEFEAT: new Set(),
};

export const canTransition = (from: CharacterState, to: CharacterState): boolean => {
  if (to === S.DEFEAT) return from !== S.DEFEAT && from !== S.VICTORY;
  if (to === S.VICTORY) return from !== S.DEFEAT && from !== S.VICTORY;
  return TRANSITIONS[from].has(to);
};
