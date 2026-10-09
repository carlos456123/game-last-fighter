export interface ComboState {
  count: number;
  damage: number;
}

export interface ComboResult {
  count: number;
  damage: number;
}

/**
 * Counts consecutive hits landed while the defender is unable to act.
 * A combo ends as soon as the defender recovers (the caller reports that).
 */
export class ComboSystem {
  private combos = new Map<string, ComboState>();
  private best = new Map<string, number>();

  /** Registers a hit and returns the new combo length (1 = first hit). */
  registerHit(attackerId: string, damage: number, defenderWasVulnerable: boolean): number {
    const current = this.combos.get(attackerId);
    const next: ComboState =
      current && defenderWasVulnerable
        ? { count: current.count + 1, damage: current.damage + damage }
        : { count: 1, damage };
    this.combos.set(attackerId, next);
    this.best.set(attackerId, Math.max(this.best.get(attackerId) ?? 0, next.count));
    return next.count;
  }

  /** Peek at the index the next hit would have, without registering it. */
  nextIndex(attackerId: string, defenderWasVulnerable: boolean): number {
    const current = this.combos.get(attackerId);
    return current && defenderWasVulnerable ? current.count + 1 : 1;
  }

  current(attackerId: string): ComboState | undefined {
    return this.combos.get(attackerId);
  }

  /** Ends the combo, returning it if it had at least 2 hits. */
  end(attackerId: string): ComboResult | null {
    const combo = this.combos.get(attackerId);
    this.combos.delete(attackerId);
    return combo && combo.count >= 2 ? { ...combo } : null;
  }

  bestCombo(attackerId: string): number {
    return this.best.get(attackerId) ?? 0;
  }

  reset(): void {
    this.combos.clear();
  }
}
