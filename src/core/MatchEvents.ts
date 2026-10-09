import type { Side } from '@/characters/Character';
import type { SkillDenyReason } from '@/combat/SkillSystem';
import type { HitLevel, MoveData, ShakeLevel, SfxId, VfxId } from '@/types';

export type RoundEndReason = 'ko' | 'time' | 'double_ko';

export interface HitEvent {
  attacker: Side;
  defender: Side;
  moveId: string;
  damage: number;
  combo: number;
  x: number;
  y: number;
  level: HitLevel;
  vfx: VfxId;
  sfx: SfxId;
  shake: ShakeLevel;
  projectile: boolean;
  armored: boolean;
  /** True for hits that belong to an ultimate. */
  ultimate: boolean;
}

export interface BlockEvent {
  attacker: Side;
  defender: Side;
  moveId: string;
  chip: number;
  x: number;
  y: number;
}

/** All events the simulation publishes. Presentation layers (HUD, audio, VFX) subscribe to these. */
export interface MatchEvents {
  hit: HitEvent;
  block: BlockEvent;
  whiff: { fighter: Side; moveId: string };
  moveStart: { fighter: Side; move: MoveData };
  denied: { fighter: Side; moveId: string; reason: SkillDenyReason };
  ultimateStart: { fighter: Side; moveId: string; freeze: number };
  projectileSpawn: { owner: Side; id: number; visual: string; x: number; y: number };
  projectileEnd: { id: number; x: number; y: number; clash: boolean };
  jump: { fighter: Side };
  land: { fighter: Side };
  dodge: { fighter: Side };
  perfectDodge: { fighter: Side; x: number; y: number };
  teleport: { fighter: Side; fromX: number; toX: number; y: number };
  stun: { fighter: Side };
  knockdown: { fighter: Side };
  comboEnd: { attacker: Side; count: number; damage: number };
  energyFull: { fighter: Side };
  roundStart: { round: number };
  countdown: { value: number };
  fight: { round: number };
  ko: { winner: Side | null; reason: RoundEndReason };
  roundEnd: { winner: Side | null; reason: RoundEndReason; wins: [number, number] };
  matchEnd: { winner: Side | null };
}
