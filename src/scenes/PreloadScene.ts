import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { getServices } from '@/systems/Services';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';

/** Loads the asset catalog with a progress bar and prepares procedural textures and fallbacks. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { assets, i18n } = getServices(this);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.text(cx, cy - 60, 'LAST FIGHTER', textStyle({ font: 'display', size: TYPE.h1 })).setOrigin(0.5);
    const label = this.add
      .text(cx, cy + 50, i18n.t('common.loading'), textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }))
      .setOrigin(0.5);
    const bar = this.add.graphics();
    const draw = (p: number): void => {
      bar.clear();
      bar.fillStyle(COLORS.panelHi, 1);
      bar.fillRect(cx - 220, cy, 440, 10);
      bar.fillStyle(COLORS.accent, 1);
      bar.fillRect(cx - 220, cy, 440 * p, 10);
    };
    draw(0);
    this.load.on('progress', (p: number) => {
      draw(p);
      label.setText(`${i18n.t('common.loading')} ${Math.round(p * 100)}%`);
    });
    assets.queue(this);
  }

  create(): void {
    const { assets } = getServices(this);
    assets.generateProceduralTextures(this);
    assets.ensureFallbacks(this);
    this.scene.start(SCENES.menu);
  }
}
