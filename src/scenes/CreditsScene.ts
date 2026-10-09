import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { getServices } from '@/systems/Services';
import { Button } from '@/ui/Button';
import { createLogo } from '@/ui/Logo';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';

/** Credits and licence notes for every third-party component. */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.credits);
  }

  create(): void {
    const { i18n } = getServices(this);
    createMenuBackground(this);
    createLogo(this, GAME_WIDTH / 2, 130, 'compact');
    this.add
      .text(
        GAME_WIDTH / 2,
        230,
        i18n.t('credits.title'),
        textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.gold }),
      )
      .setOrigin(0.5);
    i18n.list('credits.lines').forEach((line, i) => {
      const text = this.add
        .text(
          GAME_WIDTH / 2,
          290 + i * 40,
          line,
          textStyle({
            size: i === 0 ? TYPE.h3 : TYPE.body,
            align: 'center',
            color: i === 0 ? TEXT_COLORS.primary : TEXT_COLORS.dim,
          }),
        )
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: text, alpha: 1, delay: 120 * i, duration: 300 });
    });
    this.add
      .text(
        GAME_WIDTH / 2,
        560,
        i18n.t('game.lore'),
        textStyle({ size: TYPE.small, align: 'center', color: TEXT_COLORS.muted, wrap: 760 }),
      )
      .setOrigin(0.5);
    const back = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, {
      id: 'credits-back',
      label: i18n.t('common.back'),
      width: 260,
      onClick: () => goTo(this, SCENES.menu),
    });
    new MenuNavigator(this, [back], { onBack: () => goTo(this, SCENES.menu) });
    fadeIn(this);
  }
}
