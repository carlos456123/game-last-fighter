import Phaser from 'phaser';
import { getFighter } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { getArena } from '@/data/arenas';
import { getServices } from '@/systems/Services';
import {
  TOURNAMENT,
  championOf,
  currentOpponent,
  playerMatch,
  roundKey,
  type TournamentState,
} from '@/systems/TournamentManager';
import { Button, type Focusable } from '@/ui/Button';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { BattleData, DialogData, SelectData } from './SceneData';

const COL_X = [190, 470, 750, 1040] as const;
const ROW_Y0 = 150;
const ROW_H = 58;

/**
 * Hub of the Torneio da Última Arena: introduction and rules, the bracket of the current edition,
 * the next opponent, and the entry point to each match (with a short pre-fight scene).
 */
export class TournamentScene extends Phaser.Scene {
  private abandonArmed = false;

  constructor() {
    super(SCENES.tournament);
  }

  create(): void {
    const { save } = getServices(this);
    this.abandonArmed = false;
    createMenuBackground(this, COLORS.gold);
    const t = save.data.tournament;
    if (t && t.status === 'active') this.showBracket(t);
    else this.showIntro(t);
    fadeIn(this);
  }

  private tr(k: string, p?: Record<string, string | number>): string {
    return getServices(this).i18n.t(k, p);
  }

  private showIntro(last: TournamentState | null): void {
    const { save } = getServices(this);
    this.add
      .text(
        GAME_WIDTH / 2,
        50,
        this.tr('tournament.title'),
        textStyle({ font: 'display', size: TYPE.h1, color: TEXT_COLORS.gold, stroke: true }),
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        104,
        this.tr('tournament.subtitle'),
        textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
      )
      .setOrigin(0.5);
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.9);
    panel.fillRoundedRect(140, 140, 1000, 380, 12);
    panel.lineStyle(2, COLORS.gold, 0.8);
    panel.strokeRoundedRect(140, 140, 1000, 380, 12);
    this.add.text(170, 160, this.tr('tournament.story'), textStyle({ size: TYPE.small, wrap: 940 }));
    this.add.text(
      170,
      300,
      this.tr('tournament.rulesTitle'),
      textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
    );
    this.add.text(
      170,
      330,
      this.tr('tournament.rules'),
      textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 940 }),
    );
    const p = save.data.progress;
    const record = this.tr('tournament.record', { titles: p.tournamentsWon, editions: p.tournamentEditions });
    this.add.text(170, 480, record, textStyle({ size: TYPE.tiny, bold: true, color: TEXT_COLORS.gold }));
    if (last) {
      const champion = championOf(last);
      const line =
        last.status === 'champion'
          ? this.tr('tournament.lastChampion')
          : this.tr('tournament.lastEliminated', {
              champion: champion ? this.tr(getFighter(champion).nameKey) : '-',
            });
      this.add
        .text(1110, 480, line, textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, align: 'right' }))
        .setOrigin(1, 0);
    }
    const start = new Button(this, GAME_WIDTH / 2 + 160, GAME_HEIGHT - 110, {
      id: 'tournament-new',
      label: this.tr('tournament.newEdition'),
      width: 340,
      onClick: () => this.newEdition(),
    });
    const back = new Button(this, GAME_WIDTH / 2 - 210, GAME_HEIGHT - 110, {
      id: 'tournament-back',
      label: this.tr('common.back'),
      width: 260,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });
    new MenuNavigator(this, [start, back], { onBack: () => goTo(this, SCENES.menu), horizontal: true });
  }

  private newEdition(): void {
    const { save } = getServices(this);
    const select: SelectData = { mode: 'tournament' };
    // The opening story plays before the first edition only; it can always be skipped.
    if (save.data.progress.tournamentEditions === 0) {
      const dialog: DialogData = {
        titleKey: 'tournament.title',
        lines: [
          { speaker: 'council', textKey: 'story.intro1' },
          { speaker: 'council', textKey: 'story.intro2' },
          { speaker: 'han', textKey: 'story.intro3' },
        ],
        next: SCENES.select,
        nextData: select,
      };
      goTo(this, SCENES.dialog, dialog);
      return;
    }
    goTo(this, SCENES.select, select);
  }

  private showBracket(t: TournamentState): void {
    const opponent = currentOpponent(t);
    const match = playerMatch(t);
    this.add
      .text(
        GAME_WIDTH / 2,
        36,
        this.tr('tournament.title'),
        textStyle({ font: 'display', size: TYPE.h2, color: TEXT_COLORS.gold, stroke: true }),
      )
      .setOrigin(0.5);
    TOURNAMENT.roundKeys.forEach((k, i) => {
      this.add
        .text(
          COL_X[i],
          92,
          this.tr(`tournament.round.${k}`),
          textStyle({ font: 'display', size: TYPE.tiny, color: TEXT_COLORS.cyan }),
        )
        .setOrigin(0.5);
    });
    this.add
      .text(
        COL_X[3],
        92,
        this.tr('tournament.champion'),
        textStyle({ font: 'display', size: TYPE.tiny, color: TEXT_COLORS.gold }),
      )
      .setOrigin(0.5);
    const g = this.add.graphics();
    // Column 0: 8 participants. Later columns: winners of previous rounds.
    const slotY = (round: number, index: number): number => {
      const span = Math.pow(2, round);
      return ROW_Y0 + (index * span + (span - 1) / 2) * ROW_H;
    };
    const drawName = (round: number, index: number, slot: number | null, lost: boolean): void => {
      const x = COL_X[round];
      const y = slotY(round, index);
      const isPlayer = slot === 0;
      g.fillStyle(isPlayer ? COLORS.panelHi : COLORS.panel, 0.95);
      g.fillRoundedRect(x - 100, y - 20, 200, 40, 6);
      g.lineStyle(2, isPlayer ? COLORS.accent : COLORS.line, 1);
      g.strokeRoundedRect(x - 100, y - 20, 200, 40, 6);
      const name = slot === null ? '???' : this.tr(getFighter(t.participants[slot]).nameKey);
      const label = this.add
        .text(
          x,
          y,
          name,
          textStyle({
            font: 'display',
            size: TYPE.tiny,
            color: lost ? TEXT_COLORS.muted : isPlayer ? TEXT_COLORS.accent : TEXT_COLORS.primary,
          }),
        )
        .setOrigin(0.5);
      if (lost)
        g.lineStyle(2, COLORS.danger, 0.8).lineBetween(
          x - label.width / 2 - 4,
          y,
          x + label.width / 2 + 4,
          y,
        );
    };
    t.rounds.forEach((round, r) => {
      round.forEach((m, i) => {
        drawName(r, i * 2, m.a, m.winner !== null && m.winner !== m.a);
        drawName(r, i * 2 + 1, m.b, m.winner !== null && m.winner !== m.b);
        // Connector to the next column.
        const x = COL_X[r] + 100;
        const ya = slotY(r, i * 2);
        const yb = slotY(r, i * 2 + 1);
        const nx = COL_X[r + 1] - 100;
        const ny = slotY(r + 1, i);
        g.lineStyle(2, COLORS.lineHi, 0.7);
        g.lineBetween(x, ya, x + 20, ya);
        g.lineBetween(x, yb, x + 20, yb);
        g.lineBetween(x + 20, ya, x + 20, yb);
        g.lineBetween(x + 20, ny, nx, ny);
      });
    });
    for (let r = t.rounds.length; r < TOURNAMENT.rounds; r++) {
      for (let i = 0; i < Math.pow(2, TOURNAMENT.rounds - r); i++) drawName(r, i, null, false);
    }
    drawName(3, 0, null, false);

    // Next match card.
    const items: Focusable[] = [];
    if (match && opponent) {
      const arena = getArena(match.arenaId);
      g.fillStyle(COLORS.panel, 0.95);
      g.fillRoundedRect(300, 596, 640, 112, 12);
      g.lineStyle(2, COLORS.gold, 1);
      g.strokeRoundedRect(300, 596, 640, 112, 12);
      this.add.text(
        320,
        606,
        this.tr('tournament.nextMatch'),
        textStyle({ font: 'display', size: TYPE.tiny, color: TEXT_COLORS.gold }),
      );
      this.add.text(
        320,
        630,
        `${this.tr(getFighter(t.playerId).nameKey)}  ×  ${this.tr(getFighter(opponent).nameKey)}`,
        textStyle({ font: 'display', size: TYPE.body }),
      );
      this.add.text(
        320,
        664,
        `${this.tr(`tournament.round.${roundKey(t.round)}`)} · ${this.tr(arena.nameKey)}`,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }),
      );
      this.add
        .text(
          920,
          664,
          this.tr('select.standardizedShort'),
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.cyan }),
        )
        .setOrigin(1, 0);
      const fight = new Button(this, 1110, 626, {
        id: 'tournament-fight',
        label: this.tr('tournament.fight'),
        width: 300,
        height: 52,
        onClick: () => this.fight(t, opponent, match.arenaId),
      });
      items.push(fight);
    }
    const abandon = new Button(this, 1110, 686, {
      id: 'tournament-abandon',
      label: this.tr('tournament.abandon'),
      width: 300,
      height: 36,
      fontSize: TYPE.tiny,
      variant: 'danger',
      onClick: () => this.abandon(abandon),
    });
    const back = new Button(this, 150, GAME_HEIGHT - 50, {
      id: 'tournament-back',
      label: this.tr('common.back'),
      width: 220,
      height: 48,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });
    items.push(abandon, back);
    new MenuNavigator(this, items, { onBack: () => goTo(this, SCENES.menu) });
  }

  private fight(t: TournamentState, opponent: string, arenaId: string): void {
    const key = roundKey(t.round);
    const battle: BattleData = {
      mode: 'tournament',
      p1: t.playerId,
      p2: opponent,
      arena: arenaId,
      shadow: false,
      stage: t.round,
      totalStages: TOURNAMENT.rounds,
    };
    const lines: DialogData['lines'] = [
      {
        speaker: 'council',
        textKey: `story.round.${key}`,
        params: { opponent: this.tr(getFighter(opponent).nameKey) },
      },
      { speaker: opponent, textKey: getFighter(opponent).nameKey.replace('.name', '.quote') },
      { speaker: t.playerId, textKey: getFighter(t.playerId).nameKey.replace('.name', '.quote') },
    ];
    if (key === 'final') lines.push({ speaker: 'council', textKey: 'story.finalWarning' });
    const dialog: DialogData = {
      titleKey: `tournament.round.${key}`,
      lines,
      next: SCENES.battle,
      nextData: battle,
    };
    goTo(this, SCENES.dialog, dialog);
  }

  /** Abandoning needs a second press. It ends the edition without rewards. */
  private abandon(button: Button): void {
    if (!this.abandonArmed) {
      this.abandonArmed = true;
      button.setLabel(this.tr('tournament.confirmAbandon'));
      return;
    }
    const { save } = getServices(this);
    save.update((d) => {
      if (d.tournament) d.tournament.status = 'eliminated';
    });
    this.scene.restart();
  }
}
