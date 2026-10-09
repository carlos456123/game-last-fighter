import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { getFighter } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { getServices } from '@/systems/Services';
import { Button } from '@/ui/Button';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { createStatsPanel } from '@/ui/ResultPanel';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { ResultData } from './SceneData';

const TIPS = ['tips.block', 'tips.dodge', 'tips.combo', 'tips.punish', 'tips.energy'];

/** Defeat screen: retry the same ladder stage or return to the menu, with a gameplay tip. */
export class DefeatScene extends Phaser.Scene {
  private fallen: FighterRenderer | null = null;
  private clock = 0;

  constructor() {
    super(SCENES.defeat);
  }

  create(result: ResultData): void {
    const { i18n, audio } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    createMenuBackground(this, COLORS.danger);
    audio.play('defeat');
    this.clock = 0;
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        100,
        result.draw ? t('battle.draw') : t('defeat.title'),
        textStyle({ font: 'display', size: TYPE.hero, color: TEXT_COLORS.danger, stroke: true }),
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 110, duration: 500, ease: 'Cubic.Out' });
    this.fallen = new FighterRenderer(this, getFighter(result.battle.p1), 1.4).setDepth(5);

    createStatsPanel(this, 470, 200, result.stats, result.durationSeconds, i18n);
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.add.text(
      470,
      452,
      t('defeat.hint', { tip: t(tip) }),
      textStyle({ size: TYPE.small, color: TEXT_COLORS.dim, wrap: 420 }),
    );
    if (result.reward)
      this.add.text(
        470,
        520,
        t('victory.xpGained', { xp: result.reward.xp }),
        textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.gold }),
      );

    const retry = new Button(this, 1060, 320, {
      id: 'defeat-retry',
      label: t('defeat.retry'),
      width: 340,
      onClick: () => goTo(this, SCENES.battle, result.battle),
    });
    const menu = new Button(this, 1060, 400, {
      id: 'defeat-menu',
      label: t('defeat.menu'),
      width: 340,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });
    new MenuNavigator(this, [retry, menu], { onBack: () => goTo(this, SCENES.menu) });
    audio.playMusic('menu');
    fadeIn(this);
  }

  override update(): void {
    this.clock++;
    this.fallen?.drawAnimation(
      230,
      GAME_HEIGHT - 110,
      1,
      'defeat_kneel',
      Math.min(1, this.clock / 40),
      this.clock,
    );
  }
}
