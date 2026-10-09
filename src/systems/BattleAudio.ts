import type { Match } from '@/core/Match';
import type { MatchEvents } from '@/core/MatchEvents';
import type { AudioManager } from './AudioManager';

/** Maps match events to sound effects. Subscribes on creation, unsubscribes on destroy. */
export class BattleAudio {
  private readonly unsub: Array<() => void> = [];

  constructor(match: Match, audio: AudioManager) {
    const on = <K extends keyof MatchEvents>(k: K, fn: (p: MatchEvents[K]) => void): void => {
      this.unsub.push(match.events.on(k, fn));
    };
    on('hit', (e) => audio.play(e.sfx));
    on('block', () => audio.play('block'));
    on('moveStart', (e) => {
      if (e.move.kind !== 'ultimate') audio.play(e.move.startSfx ?? 'whiff');
    });
    on('ultimateStart', () => audio.play('ultimate_start'));
    on('jump', () => audio.play('jump'));
    on('land', () => audio.play('land'));
    on('dodge', () => audio.play('dodge'));
    on('perfectDodge', () => audio.play('perfect_dodge'));
    on('stun', () => audio.play('stun'));
    on('ko', () => audio.play('ko'));
    on('countdown', () => audio.play('countdown'));
    on('fight', () => audio.play('fight'));
    on('energyFull', (e) => {
      if (e.fighter === 'p1') audio.play('energy_full');
    });
    on('denied', (e) => {
      if (e.fighter === 'p1') audio.play('ui_error');
    });
    on('projectileEnd', (e) => {
      if (e.clash) audio.play('block');
    });
    on('knockdown', () => audio.play('land'));
  }

  destroy(): void {
    for (const u of this.unsub) u();
  }
}
