import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';
import { InputManager } from '@/input/InputManager';
import { KeyboardController } from '@/input/KeyboardController';
import { TouchController } from '@/input/TouchController';
import { AssetManager } from '@/systems/AssetManager';
import { AudioManager } from '@/systems/AudioManager';
import { LocalizationManager } from '@/systems/LocalizationManager';
import { ProgressionManager } from '@/systems/ProgressionManager';
import { SaveManager, browserStorage } from '@/systems/SaveManager';
import { registerServices, type Services } from '@/systems/Services';
import { SettingsManager } from '@/systems/SettingsManager';
import { installTestHook } from '@/systems/TestHook';
import { Logger } from '@/utils/Logger';

const FONT_TIMEOUT_MS = 2500;

/** Creates the long-lived services, waits for fonts, then hands over to the preloader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    const services = this.createServices();
    registerServices(this.game, services);
    installTestHook(this.game);
    this.translateDom(services.i18n);
    void this.waitForFonts().then(() => this.scene.start(SCENES.preload));
  }

  private createServices(): Services {
    const save = new SaveManager(browserStorage());
    save.load();
    const settings = new SettingsManager(save);
    const i18n = new LocalizationManager(settings.settings.language);
    const audio = new AudioManager(settings.settings);
    const keyboard = new KeyboardController(settings.controls);
    keyboard.attach();
    const touch = new TouchController();
    const input = new InputManager(keyboard, touch);

    settings.events.on('change', (s) => {
      audio.applySettings(s);
      i18n.setLanguage(s.language);
    });
    settings.events.on('controls', (c) => keyboard.setBindings(c));

    // Browsers only allow audio after a user gesture.
    const unlock = (): void => audio.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend'])
      window.addEventListener(type, unlock, { passive: true });

    return {
      save,
      settings,
      i18n,
      audio,
      keyboard,
      touch,
      input,
      progression: new ProgressionManager(FIGHTERS, ARENAS),
      assets: new AssetManager(),
    };
  }

  private translateDom(i18n: LocalizationManager): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = i18n.t(key);
    });
  }

  private async waitForFonts(): Promise<void> {
    if (!('fonts' in document)) return;
    const loads = Promise.all([
      document.fonts.load('400 32px "Russo One"'),
      document.fonts.load('400 20px "Chakra Petch"'),
      document.fonts.load('700 20px "Chakra Petch"'),
    ]);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    try {
      await Promise.race([loads, timeout]);
    } catch (err) {
      Logger.warn('Boot', 'Fonts failed to load, using fallbacks.', err);
    }
  }
}
