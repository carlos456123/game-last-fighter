import type { ControlBindings, Settings } from '@/types';
import { EventBus } from '@/core/EventBus';
import type { SaveManager } from './SaveManager';

interface SettingsEvents {
  change: Settings;
  controls: ControlBindings;
}

/** Typed access to settings and key bindings. Every change is persisted and broadcast. */
export class SettingsManager {
  readonly events = new EventBus<SettingsEvents>();

  constructor(private readonly save: SaveManager) {}

  get settings(): Readonly<Settings> {
    return this.save.data.settings;
  }

  get controls(): Readonly<ControlBindings> {
    return this.save.data.controls;
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.save.data.settings[key] === value) return;
    this.save.update((d) => {
      d.settings[key] = value;
    });
    this.events.emit('change', this.settings);
  }

  setControls(bindings: ControlBindings): void {
    this.save.update((d) => {
      d.controls = bindings;
    });
    this.events.emit('controls', this.controls);
  }
}
