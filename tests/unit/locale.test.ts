import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';
import { ACHIEVEMENTS } from '@/data/progression/achievements';
import { MASTERY, SPECIALIZATIONS } from '@/data/progression/specializations';
import { UNLOCK_RULES } from '@/data/progression/unlocks';
import { TOURNAMENT } from '@/systems/TournamentManager';
import { LocalizationManager } from '@/systems/LocalizationManager';

/** Keys built at runtime (template strings) are invisible to a plain grep, so they are checked here. */
describe('Localization — dynamic keys', () => {
  const i18n = new LocalizationManager('pt-BR');
  const expectKey = (key: string): void => {
    expect(i18n.has(key), key).toBe(true);
  };

  it('every fighter has quotes and the Reflexo has its own texts', () => {
    for (const f of FIGHTERS) {
      expectKey(f.nameKey.replace('.name', '.quote'));
      expectKey(f.nameKey.replace('.name', '.winQuote'));
    }
    expectKey('fighters.shadow.name');
    expectKey('fighters.shadow.quote');
  });

  it('every unlock rule type has a requirement text', () => {
    for (const rule of Object.values(UNLOCK_RULES)) {
      if (rule.type !== 'default') expectKey(`unlock.${rule.type}`);
    }
  });

  it('every specialization, achievement and title has text', () => {
    for (const s of SPECIALIZATIONS) {
      expectKey(s.nameKey);
      expectKey(s.descKey);
    }
    for (const a of ACHIEVEMENTS) {
      expectKey(a.nameKey);
      expectKey(a.descKey);
      if (a.title) expectKey(a.title);
    }
  });

  it('mastery levels, tournament rounds and story lines have text', () => {
    for (let l = 1; l <= MASTERY.maxLevel; l++) expectKey(`mastery.level${l}`);
    for (const k of TOURNAMENT.roundKeys) {
      expectKey(`tournament.round.${k}`);
      expectKey(`story.round.${k}`);
    }
    for (const k of [
      'intro1',
      'intro2',
      'intro3',
      'shadow1',
      'shadow2',
      'shadowTitle',
      'arcadeEnd1',
      'arcadeEnd2',
      'champion1',
      'champion2',
      'champion3',
      'finalWarning',
      'council',
    ]) {
      expectKey(`story.${k}`);
    }
  });

  it('every reward line and arena has text', () => {
    for (const k of [
      'win',
      'stage',
      'shadow',
      'ladder',
      'tournamentRound',
      'tournamentChampion',
      'perfect',
      'flawless',
      'combo',
      'fast',
      'effort',
    ]) {
      expectKey(`rewards.${k}`);
    }
    for (const a of ARENAS) expectKey(a.nameKey);
  });
});
