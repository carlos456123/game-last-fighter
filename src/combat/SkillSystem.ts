import { COMBAT } from '@/config/gameConfig';
import type { MoveData } from '@/types';

export type SkillDenyReason = 'energy' | 'cooldown' | 'context';

/** Tracks per-move cooldowns and energy rules for one fighter. */
export class SkillSystem {
  private cooldowns = new Map<string, number>();
  energy = 0;

  constructor(public readonly maxEnergy: number = COMBAT.energyMax) {}

  tick(): void {
    for (const [id, frames] of this.cooldowns) {
      if (frames <= 1) this.cooldowns.delete(id);
      else this.cooldowns.set(id, frames - 1);
    }
  }

  cooldownOf(moveId: string): number {
    return this.cooldowns.get(moveId) ?? 0;
  }

  check(move: MoveData, airborne: boolean): SkillDenyReason | null {
    if ((move.context === 'air') !== airborne) return 'context';
    if (this.cooldownOf(move.id) > 0) return 'cooldown';
    if (this.energy < move.energyCost) return 'energy';
    return null;
  }

  /** Spends energy and starts the cooldown. Caller must have validated with `check`. */
  commit(move: MoveData): void {
    this.energy = Math.max(0, this.energy - move.energyCost);
    if (move.cooldown > 0) this.cooldowns.set(move.id, move.cooldown);
  }

  gain(amount: number): boolean {
    const wasFull = this.energy >= this.maxEnergy;
    this.energy = Math.min(this.maxEnergy, this.energy + Math.max(0, amount));
    return !wasFull && this.energy >= this.maxEnergy;
  }

  reset(energy: number): void {
    this.cooldowns.clear();
    this.energy = Math.min(this.maxEnergy, energy);
  }
}
