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
import type { BattleData, ResultData } from './SceneData';

/** Victory screen: animated title, the winner's victory pose, rewards, unlocks and stats. */
export class VictoryScene extends Phaser.Scene {
  private winner: FighterRenderer | null = null;
  private clock = 0;

  constructor() {
    super(SCENES.victory);
  }

  create(result: ResultData): void {
    const { i18n, audio, save } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    createMenuBackground(this, COLORS.gold);
    audio.play('victory');
    this.clock = 0;
    const champion = result.reward?.ladderComplete ?? false;

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        90,
        champion ? t('victory.champion') : t('victory.title'),
        textStyle({
          font: 'display',
          size: champion ? TYPE.h1 : TYPE.hero,
          color: TEXT_COLORS.gold,
          stroke: true,
        }),
      )
      .setOrigin(0.5)
      .setScale(2)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });

    const fighter = getFighter(result.battle.p1);
    this.winner = new FighterRenderer(this, fighter, 1.5).setDepth(5);
    this.add
      .text(250, 660, t(fighter.nameKey), textStyle({ font: 'display', size: TYPE.h3, stroke: true }))
      .setOrigin(0.5);

    // Rewards
    const reward = result.reward;
    const rx = 520;
    let ry = 190;
    if (reward) {
      this.add.text(
        rx,
        ry,
        t('victory.rewards'),
        textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
      );
      ry += 36;
      reward.bonuses.forEach((b, i) => {
        const line = this.add
          .text(rx, ry + i * 30, `${t(b.key)}  +${b.xp}`, textStyle({ size: TYPE.small }))
          .setAlpha(0);
        this.tweens.add({ targets: line, alpha: 1, x: rx + 6, delay: 300 + i * 140, duration: 200 });
      });
      ry += reward.bonuses.length * 30 + 10;
      this.add.text(
        rx,
        ry,
        t('victory.xpGained', { xp: reward.xp }),
        textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.gold }),
      );
      ry += 46;
      if (reward.levelAfter > reward.levelBefore) {
        this.add.text(
          rx,
          ry,
          t('victory.levelUp', { level: reward.levelAfter }),
          textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.success }),
        );
        ry += 34;
      }
      for (const id of reward.unlocked) {
        audio.play('unlock');
        const banner = this.add
          .text(
            rx,
            ry,
            `🔓 ${t('victory.unlocked', { name: t(getFighter(id).nameKey) })}`,
            textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.accent }),
          )
          .setAlpha(0);
        this.tweens.add({ targets: banner, alpha: 1, delay: 900, duration: 300, yoyo: false });
        ry += 34;
      }
      if (champion)
        this.add.text(
          rx,
          ry,
          t('victory.championText'),
          textStyle({ size: TYPE.small, color: TEXT_COLORS.dim, wrap: 360 }),
        );
    }
    createStatsPanel(this, 820, 190, result.stats, result.durationSeconds, i18n);

    const buttons: Button[] = [];
    const ladder = save.data.progress.ladder;
    if (result.battle.mode === 'ladder' && ladder && !champion) {
      const stage = ladder.stages[ladder.stage];
      this.add
        .text(
          1030,
          452,
          `${t('select.stage', { stage: ladder.stage + 1, total: ladder.stages.length })} · ${t('select.nextOpponent', { name: t(stage.shadow ? 'fighters.shadow.name' : getFighter(stage.opponentId).nameKey) })}`,
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }),
        )
        .setOrigin(0.5);
      buttons.push(
        new Button(this, 1030, 510, {
          id: 'victory-next',
          label: t('victory.next'),
          width: 380,
          onClick: () => {
            const data: BattleData = {
              mode: 'ladder',
              p1: ladder.fighterId,
              p2: stage.opponentId,
              arena: stage.arenaId,
              shadow: stage.shadow,
              stage: ladder.stage,
              totalStages: ladder.stages.length,
            };
            goTo(this, SCENES.battle, data);
          },
        }),
      );
    }
    buttons.push(
      new Button(this, 1030, 580, {
        id: 'victory-menu',
        label: t('victory.menu'),
        width: 380,
        variant: 'secondary',
        onClick: () => goTo(this, SCENES.menu),
      }),
    );
    new MenuNavigator(this, buttons, { onBack: () => goTo(this, SCENES.menu) });
    audio.playMusic('menu');
    fadeIn(this);
  }

  override update(): void {
    this.clock++;
    this.winner?.drawAnimation(
      250,
      GAME_HEIGHT - 90,
      1,
      `victory_${this.winner.data.body.victory}`,
      Math.min(1, this.clock / 40),
      this.clock,
    );
  }
}
