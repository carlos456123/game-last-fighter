export const AIState = {
  IDLE: 'IDLE',
  OBSERVE: 'OBSERVE',
  APPROACH: 'APPROACH',
  RETREAT: 'RETREAT',
  ATTACK: 'ATTACK',
  DEFEND: 'DEFEND',
  DODGE: 'DODGE',
  CHASE: 'CHASE',
  STUNNED: 'STUNNED',
  USE_SKILL: 'USE_SKILL',
  USE_ULTIMATE: 'USE_ULTIMATE',
  RECOVER: 'RECOVER',
  DEFEATED: 'DEFEATED',
} as const;
export type AIStateId = (typeof AIState)[keyof typeof AIState];
