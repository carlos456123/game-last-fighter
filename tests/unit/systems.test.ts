import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLS, SAVE_KEY, SAVE_VERSION } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';
import { findConflicts, keyLabel, rebind } from '@/input/ControlMapping';
import { LocalizationManager, interpolate } from '@/systems/LocalizationManager';
import { SaveManager, type StorageLike } from '@/systems/SaveManager';
import { SettingsManager } from '@/systems/SettingsManager';
import { ALL_ACTIONS } from '@/types';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

describe('SaveManager', () => {
  it('creates a versioned default save when empty', () => {
    const sm = new SaveManager(new MemoryStorage());
    const data = sm.load();
    expect(data.saveVersion).toBe(SAVE_VERSION);
    expect(sm.lastIssue).toBe('empty');
    expect(data.progress.unlockedFighters).toEqual(['kael', 'bronn']);
  });

  it('persists and reloads data', () => {
    const storage = new MemoryStorage();
    const a = new SaveManager(storage);
    a.load();
    a.update((d) => {
      d.settings.musicVolume = 0.25;
      d.progress.wins = 3;
    });
    const b = new SaveManager(storage);
    const data = b.load();
    expect(data.settings.musicVolume).toBe(0.25);
    expect(data.progress.wins).toBe(3);
  });

  it('recovers from corrupt JSON and keeps a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const sm = new SaveManager(storage);
    const data = sm.load();
    expect(sm.lastIssue).toBe('corrupt');
    expect(data.progress.wins).toBe(0);
    expect(storage.getItem(`${SAVE_KEY}-corrupt-backup`)).toBe('{not json');
  });

  it('sanitizes invalid values and unknown fighters', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        saveVersion: 1,
        settings: { musicVolume: 7, quality: 'ultra', difficulty: 'hard' },
        controls: { light: [], heavy: ['KeyP'] },
        progress: { unlockedFighters: ['nyx', 'hacker'], wins: -4 },
      }),
    );
    const data = new SaveManager(storage).load();
    expect(data.settings.musicVolume).toBe(1);
    expect(data.settings.quality).toBe('high');
    expect(data.settings.difficulty).toBe('hard');
    expect(data.controls.light).toEqual(DEFAULT_CONTROLS.light);
    expect(data.controls.heavy).toEqual(['KeyP']);
    expect(data.progress.unlockedFighters).toEqual(['kael', 'bronn', 'nyx']);
    expect(data.progress.wins).toBe(0);
  });

  it('migrates the legacy unversioned format', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ volume: 0.3, unlocked: ['nyx'] }));
    const sm = new SaveManager(storage);
    const data = sm.load();
    expect(sm.lastIssue).toBe('migrated');
    expect(data.settings.musicVolume).toBe(0.3);
    expect(data.progress.unlockedFighters).toContain('nyx');
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).saveVersion).toBe(SAVE_VERSION);
  });

  it('does not overwrite saves from a newer version', () => {
    const storage = new MemoryStorage();
    const future = JSON.stringify({ saveVersion: 99, progress: { wins: 50 } });
    storage.setItem(SAVE_KEY, future);
    const sm = new SaveManager(storage);
    sm.load();
    expect(sm.lastIssue).toBe('future_version');
    sm.update((d) => (d.progress.wins = 1));
    expect(storage.getItem(SAVE_KEY)).toBe(future);
  });

  it('works without storage at all', () => {
    const sm = new SaveManager(null);
    expect(sm.load().saveVersion).toBe(SAVE_VERSION);
    expect(sm.persist()).toBe(false);
  });

  it('settings manager persists and broadcasts changes', () => {
    const storage = new MemoryStorage();
    const sm = new SaveManager(storage);
    sm.load();
    const settings = new SettingsManager(sm);
    const seen: boolean[] = [];
    settings.events.on('change', (s) => seen.push(s.screenShake));
    settings.set('screenShake', false);
    expect(seen).toEqual([false]);
    expect(new SaveManager(storage).load().settings.screenShake).toBe(false);
  });
});

describe('Control mapping', () => {
  it('rebinding to a free key replaces the primary', () => {
    const r = rebind(DEFAULT_CONTROLS, 'light', 'KeyO');
    expect(r.bindings.light).toEqual(['KeyO']);
    expect(r.swappedWith).toBeNull();
    expect(findConflicts(r.bindings)).toEqual([]);
  });

  it('rebinding to a used key swaps instead of conflicting', () => {
    const r = rebind(DEFAULT_CONTROLS, 'light', 'KeyK');
    expect(r.swappedWith).toBe('heavy');
    expect(r.bindings.light[0]).toBe('KeyK');
    expect(r.bindings.heavy).toContain('KeyJ');
    expect(findConflicts(r.bindings)).toEqual([]);
    for (const a of ALL_ACTIONS) expect(r.bindings[a].length).toBeGreaterThan(0);
  });

  it('rejects reserved keys', () => {
    const r = rebind(DEFAULT_CONTROLS, 'light', 'F5');
    expect(r.rejected).toBe(true);
    expect(r.bindings).toBe(DEFAULT_CONTROLS);
  });

  it('default controls have no conflicts', () => {
    expect(findConflicts(DEFAULT_CONTROLS)).toEqual([]);
  });

  it('formats key labels', () => {
    expect(keyLabel('KeyJ')).toBe('J');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Space')).toBe('@keys.space');
    expect(keyLabel('Digit3')).toBe('3');
  });
});

describe('Localization', () => {
  const i18n = new LocalizationManager('pt-BR');

  it('interpolates parameters', () => {
    expect(interpolate('Nível {level}', { level: 3 })).toBe('Nível 3');
    expect(i18n.t('battle.hits', { count: 5 })).toBe('5 GOLPES');
  });

  it('returns the key for missing entries instead of crashing', () => {
    expect(i18n.t('does.not.exist')).toBe('does.not.exist');
  });

  it('every fighter, move and arena has text', () => {
    for (const f of FIGHTERS) {
      for (const key of [
        f.nameKey,
        f.titleKey,
        f.bioKey,
        f.personalityKey,
        f.originKey,
        f.styleKey,
        f.weaknessKey,
      ]) {
        expect(i18n.has(key), key).toBe(true);
      }
      for (const m of f.moves) {
        expect(i18n.has(m.nameKey), m.nameKey).toBe(true);
        expect(i18n.has(m.descKey), m.descKey).toBe(true);
      }
      expect(i18n.has(`archetypes.${f.archetype}`)).toBe(true);
    }
    for (const a of ARENAS) expect(i18n.has(a.nameKey)).toBe(true);
    for (const a of ALL_ACTIONS) expect(i18n.has(`actions.${a}`)).toBe(true);
  });
});
