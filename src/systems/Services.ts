import type Phaser from 'phaser';
import type { InputManager } from '@/input/InputManager';
import type { KeyboardController } from '@/input/KeyboardController';
import type { TouchController } from '@/input/TouchController';
import type { AssetManager } from './AssetManager';
import type { AudioManager } from './AudioManager';
import type { LocalizationManager } from './LocalizationManager';
import type { ProgressionManager } from './ProgressionManager';
import type { SaveManager } from './SaveManager';
import type { SettingsManager } from './SettingsManager';

/** Long-lived systems shared by every scene, created once at boot and stored in the game registry. */
export interface Services {
  save: SaveManager;
  settings: SettingsManager;
  i18n: LocalizationManager;
  audio: AudioManager;
  progression: ProgressionManager;
  keyboard: KeyboardController;
  touch: TouchController;
  input: InputManager;
  assets: AssetManager;
}

const KEY = 'services';

export const registerServices = (game: Phaser.Game, services: Services): void => {
  game.registry.set(KEY, services);
};

export const getServices = (scene: Phaser.Scene): Services => {
  const services = scene.game.registry.get(KEY) as Services | undefined;
  if (!services) throw new Error('Services not initialised: BootScene must run first');
  return services;
};
