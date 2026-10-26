import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { getFighter } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { getServices } from '@/systems/Services';
import { Button } from '@/ui/Button';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { createStatsPanel } from '@/ui/ResultPanel';
import { showRewards } from '@/ui/RewardSummary';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { BattleData, DialogData, ResultData } from './SceneData';

/** Victory screen: the winner's pose, rewards, unlocks, stats and the next step of the current mode. */
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
    const arcadeChampion = result.reward?.ladderComplete ?? false;
    const tournamentChampion = result.tournament?.champion ?? false;
    const titleText = tournamentChampion
      ? t('victory.tournamentChampion')
      : arcadeChampion
        ? t('victory.champion')
        : t('victory.title');
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        80,
        titleText,
        textStyle({
          font: 'display',
          size: arcadeChampion || tournamentChampion ? TYPE.h1 : TYPE.hero,
          color: TEXT_COLORS.gold,
          stroke: true,
        }),
      )
      .setOrigin(0.5)
      .setScale(2)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });

    const fighter = getFighter(result.battle.p1);
    this.winner = new FighterRenderer(this, fighter, 1.45).setDepth(5);
    this.add
      .text(240, 660, t(fighter.nameKey), textStyle({ font: 'display', size: TYPE.h3, stroke: true }))
      .setOrigin(0.5);
    const winQuote = t(fighter.nameKey.replace('.name', '.winQuote'));
    this.add
      .text(
        240,
        160,
        `“${winQuote}”`,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, align: 'center', wrap: 340 }),
      )
      .setOrigin(0.5, 0);

    if (result.reward) showRewards(this, 500, 160, result.reward, i18n, audio);
    createStatsPanel(this, 820, 160, result.stats, result.durationSeconds, i18n);

    const buttons: Button[] = [];
    const mode = result.battle.mode;
    const ladder = save.data.progress.ladder;
    if (mode === 'ladder' && ladder && !arcadeChampion) {
      const stage = ladder.stages[ladder.stage];
      const opponentName = t(stage.shadow ? 'fighters.shadow.name' : getFighter(stage.opponentId).nameKey);
      this.add
        .text(
          1030,
          420,
          `${t('select.stage', { stage: ladder.stage + 1, total: ladder.stages.length })} · ${t('select.nextOpponent', { name: opponentName })}`,
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }),
        )
        .setOrigin(0.5);
      const battle: BattleData = {
        mode: 'ladder',
        p1: ladder.fighterId,
        p2: stage.opponentId,
        arena: stage.arenaId,
        shadow: stage.shadow,
        stage: ladder.stage,
        totalStages: ladder.stages.length,
      };
      buttons.push(
        new Button(this, 1030, 480, {
          id: 'victory-next',
          label: t('victory.next'),
          width: 380,
          onClick: () => {
            if (!stage.shadow) {
              goTo(this, SCENES.battle, battle);
              return;
            }
            // The final Arcade stage is introduced by the Reflexo itself.
            const dialog: DialogData = {
              titleKey: 'story.shadowTitle',
              lines: [
                { speaker: 'shadow', textKey: 'story.shadow1', params: { fighter: ladder.fighterId } },
                { speaker: ladder.fighterId, textKey: 'story.shadow2' },
                {
                  speaker: 'shadow',
                  textKey: 'fighters.shadow.quote',
                  params: { fighter: ladder.fighterId },
                },
              ],
              next: SCENES.battle,
              nextData: battle,
            };
            goTo(this, SCENES.dialog, dialog);
          },
        }),
      );
    }
    if (mode === 'ladder' && arcadeChampion) {
      const ending: DialogData = {
        titleKey: 'victory.champion',
        lines: [
          { speaker: 'narrator', textKey: 'story.arcadeEnd1' },
          { speaker: 'council', textKey: 'story.arcadeEnd2' },
        ],
        next: SCENES.menu,
      };
      buttons.push(
        new Button(this, 1030, 480, {
          id: 'victory-next',
          label: t('victory.epilogue'),
          width: 380,
          onClick: () => goTo(this, SCENES.dialog, ending),
        }),
      );
    }
    if (mode === 'tournament') {
      if (tournamentChampion) {
        const ending: DialogData = {
          titleKey: 'victory.tournamentChampion',
          lines: [
            { speaker: 'council', textKey: 'story.champion1', params: { fighter: t(fighter.nameKey) } },
            { speaker: 'valkyrie', textKey: 'story.champion2' },
            { speaker: 'valkyrie', textKey: 'story.champion3' },
          ],
          next: SCENES.tournament,
        };
        buttons.push(
          new Button(this, 1030, 480, {
            id: 'victory-next',
            label: t('victory.epilogue'),
            width: 380,
            onClick: () => goTo(this, SCENES.dialog, ending),
          }),
        );
      } else {
        buttons.push(
          new Button(this, 1030, 480, {
            id: 'victory-next',
            label: t('victory.continueTournament'),
            width: 380,
            onClick: () => goTo(this, SCENES.tournament),
          }),
        );
      }
    }
    buttons.push(
      new Button(this, 1030, 550, {
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
      240,
      GAME_HEIGHT - 90,
      1,
      `victory_${this.winner.data.body.victory}`,
      Math.min(1, this.clock / 40),
      this.clock,
    );
  }
}
