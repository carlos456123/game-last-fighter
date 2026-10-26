import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { computeRatings, lightChainLength } from '@/characters/CharacterStats';
import { FPS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { ARENAS } from '@/data/arenas';
import { getSpec } from '@/data/progression/specializations';
import { isUnlocked, masteryOf } from '@/systems/ProgressionManager';
import { getServices } from '@/systems/Services';
import { createTournament } from '@/systems/TournamentManager';
import type { Difficulty, FighterData, MoveSlot, RatingKey } from '@/types';
import { Button, type Focusable } from '@/ui/Button';
import { CARD_H, CARD_W, CharacterCard, LOCKED_PALETTE } from '@/ui/CharacterCard';
import { drawIcon, iconForMove } from '@/ui/Icons';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import { unlockText } from '@/ui/UnlockText';
import type { BattleData, SelectData, SelectMode } from './SceneData';

const RATING_KEYS: RatingKey[] = ['power', 'defense', 'speed', 'range', 'mobility', 'technique'];
const MOVE_SLOTS: MoveSlot[] = ['light', 'heavy', 'skill', 'special', 'ultimate'];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const GRID = { cols: 3, x0: 92, y0: 128, gap: 10 } as const;
const PANEL = { x: 480, y: 76, w: 776, h: 560 } as const;

/**
 * Roster screen for all nine fighters. Arcade mode starts a ladder, tournament mode starts a new
 * edition of the Torneio da Última Arena, browse mode is a codex. Locked fighters show exactly
 * how to unlock them and cannot be picked.
 */
export class CharacterSelectScene extends Phaser.Scene {
  private mode: SelectMode = 'arcade';
  private cards: CharacterCard[] = [];
  private index = 0;
  private clock = 0;
  private preview: FighterRenderer | null = null;
  private detail!: Phaser.GameObjects.Container;
  private confirmButton: Button | null = null;
  private showcase: string[] = ['idle'];

  constructor() {
    super(SCENES.select);
  }

  init(data: SelectData): void {
    this.mode = data?.mode ?? 'arcade';
    this.cards = [];
    this.index = 0;
    this.clock = 0;
    this.preview = null;
    this.confirmButton = null;
  }

  create(): void {
    const { i18n, save, settings } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    createMenuBackground(this, this.mode === 'tournament' ? COLORS.gold : COLORS.cyan);
    const titleKey =
      this.mode === 'browse'
        ? 'select.browseTitle'
        : this.mode === 'tournament'
          ? 'select.tournamentTitle'
          : 'select.title';
    this.add
      .text(GAME_WIDTH / 2, 34, t(titleKey), textStyle({ font: 'display', size: TYPE.h2, stroke: true }))
      .setOrigin(0.5);

    FIGHTERS.forEach((f, i) => {
      const unlock = unlockText(i18n, save.data, f);
      const col = i % GRID.cols;
      const row = Math.floor(i / GRID.cols);
      const card = new CharacterCard(
        this,
        GRID.x0 + col * (CARD_W + GRID.gap),
        GRID.y0 + row * (CARD_H + GRID.gap),
        f,
        {
          name: t(f.nameKey),
          locked: !unlock.unlocked,
          progress: unlock.progress,
          mastery: unlock.unlocked ? masteryOf(save.data, f.id).level : 0,
        },
        () => {
          if (this.index === i) this.confirm();
          else this.select(i);
        },
      );
      this.cards.push(card);
    });

    this.detail = this.add.container(0, 0);
    const back = new Button(this, 150, GAME_HEIGHT - 40, {
      id: 'select-back',
      label: t('common.back'),
      width: 220,
      height: 48,
      variant: 'secondary',
      onClick: () => this.back(),
    });

    const cardsRow: Focusable = {
      enabled: true,
      visible: true,
      setFocused: () => this.cards[this.index]?.setSelected(true),
      activate: () => this.confirm(),
      adjust: (d) => this.select((this.index + d + this.cards.length) % this.cards.length),
    };
    const items: Focusable[] = [cardsRow];
    if (this.mode !== 'browse') {
      let current = Math.max(0, DIFFICULTIES.indexOf(settings.settings.difficulty));
      const diffLabel = (d: Difficulty): string => `${t('select.difficulty')}: ${t(`difficulty.${d}`)}  ◀ ▶`;
      const diff = new Button(this, 720, GAME_HEIGHT - 40, {
        id: 'select-difficulty',
        label: diffLabel(DIFFICULTIES[current]),
        width: 380,
        height: 48,
        variant: 'secondary',
        fontSize: TYPE.small,
        onClick: () => change(1),
        onAdjust: (d) => change(d),
      });
      function change(d: -1 | 1): void {
        current = (current + d + DIFFICULTIES.length) % DIFFICULTIES.length;
        settings.set('difficulty', DIFFICULTIES[current]);
        diff.setLabel(diffLabel(DIFFICULTIES[current]));
      }
      this.confirmButton = new Button(this, 1110, GAME_HEIGHT - 40, {
        id: 'select-fight',
        label: this.mode === 'tournament' ? t('select.enterTournament') : t('select.fight'),
        width: 260,
        height: 52,
        onClick: () => this.confirm(),
      });
      items.push(diff, this.confirmButton);
    }
    items.push(back);
    new MenuNavigator(this, items, { onBack: () => this.back() });
    // Start on the last fighter used in this mode if possible.
    const lastId = save.data.progress.ladder?.fighterId ?? save.data.tournament?.playerId;
    const start = Math.max(
      0,
      FIGHTERS.findIndex((f) => f.id === lastId && isUnlocked(save.data, f)),
    );
    this.select(start);
    fadeIn(this);
  }

  private back(): void {
    goTo(
      this,
      this.mode === 'tournament'
        ? SCENES.tournament
        : this.mode === 'browse'
          ? SCENES.progression
          : SCENES.menu,
    );
  }

  private select(i: number): void {
    this.index = i;
    this.cards.forEach((c, j) => c.setSelected(j === i));
    const f = this.cards[i].fighter;
    this.preview?.destroy();
    this.preview = new FighterRenderer(this, f, 0.95).setDepth(5);
    if (this.cards[i].locked) this.preview.setPalette(LOCKED_PALETTE);
    this.confirmButton?.setEnabled(!this.cards[i].locked);
    const anim = (slot: MoveSlot): string => f.moves.find((m) => m.id === f.slots[slot])?.animation ?? 'idle';
    this.showcase = ['idle', anim('light'), anim('heavy'), anim('special'), 'idle', anim('skill')];
    this.renderDetail(f, this.cards[i].locked);
    getServices(this).audio.play('ui_hover');
  }

  private confirm(): void {
    if (this.mode === 'browse') return;
    const card = this.cards[this.index];
    const { audio, progression, save } = getServices(this);
    if (card.locked) {
      audio.play('ui_error');
      this.tweens.add({ targets: card, x: card.x + 6, duration: 40, yoyo: true, repeat: 3 });
      return;
    }
    audio.play('ui_click');
    if (this.mode === 'tournament') {
      save.update((d) => {
        d.tournament = createTournament(
          card.fighter.id,
          FIGHTERS.map((x) => x.id),
          ARENAS.map((a) => a.id),
          d.progress.tournamentEditions,
          (Date.now() % 1_000_000_007) + d.progress.tournamentEditions,
        );
        d.progress.tournamentEditions++;
      });
      goTo(this, SCENES.tournament);
      return;
    }
    save.update((d) => progression.startLadder(d, card.fighter.id));
    const ladder = save.data.progress.ladder!;
    const stage = ladder.stages[0];
    const data: BattleData = {
      mode: 'ladder',
      p1: card.fighter.id,
      p2: stage.opponentId,
      arena: stage.arenaId,
      shadow: stage.shadow,
      stage: 0,
      totalStages: ladder.stages.length,
    };
    goTo(this, SCENES.battle, data);
  }

  private renderDetail(f: FighterData, locked: boolean): void {
    const { i18n, save } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    this.detail.removeAll(true);
    const x0 = PANEL.x + 20;
    const y0 = PANEL.y + 18;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.detail.add(o);
      return o;
    };
    const panel = add(this.add.graphics());
    panel.fillStyle(COLORS.panel, 0.9);
    panel.fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    panel.lineStyle(2, COLORS.line, 1);
    panel.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    panel.fillStyle(locked ? COLORS.line : f.palette.primary, 1);
    panel.fillRect(PANEL.x, PANEL.y, 6, PANEL.h);

    add(this.add.text(x0, y0, t(f.nameKey), textStyle({ font: 'display', size: TYPE.h2 })));
    add(this.add.text(x0, y0 + 46, t(f.titleKey), textStyle({ size: TYPE.body, color: TEXT_COLORS.gold })));
    const meta = add(
      this.add.text(
        x0,
        y0 + 80,
        [
          `${t('select.archetype')}: ${t(`archetypes.${f.archetype}`)}  ·  ${t('select.mainAttribute')}: ${t(`ratings.${f.mainAttribute}`)}`,
          `${t('select.health', { value: f.stats.health })}  ·  ${t('select.style')}: ${t(f.styleKey)}`,
        ],
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 360 }),
      ),
    );
    const bio = add(
      this.add.text(x0, meta.y + meta.height + 8, t(f.bioKey), textStyle({ size: TYPE.tiny, wrap: 360 })),
    );
    const weak = add(
      this.add.text(
        x0,
        bio.y + bio.height + 6,
        `${t('select.weakness')}: ${t(f.weaknessKey)}`,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.danger, wrap: 360 }),
      ),
    );

    // Mastery / standardized attributes note.
    let infoY = weak.y + weak.height + 10;
    if (!locked) {
      const m = masteryOf(save.data, f.id);
      const spec = m.spec ? getSpec(m.spec) : undefined;
      const line =
        this.mode === 'tournament'
          ? t('select.standardized')
          : spec && m.level >= 2
            ? t('select.masteryWithSpec', { level: t(`mastery.level${m.level}`), spec: t(spec.nameKey) })
            : t('select.mastery', { level: t(`mastery.level${m.level}`) });
      const info = add(
        this.add.text(
          x0,
          infoY,
          line,
          textStyle({ size: TYPE.tiny, bold: true, color: TEXT_COLORS.cyan, wrap: 360 }),
        ),
      );
      infoY = info.y + info.height + 8;
    }

    // Ratings derived from the real data (bars + main attribute highlighted).
    const ratings = computeRatings(f);
    const g = add(this.add.graphics());
    const ry0 = Math.max(infoY, PANEL.y + PANEL.h - 80);
    RATING_KEYS.forEach((k, i) => {
      const ry = ry0 + Math.floor(i / 2) * 22;
      const rx = x0 + (i % 2) * 186;
      add(
        this.add
          .text(rx, ry, t(`ratings.${k}`), textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }))
          .setOrigin(0, 0.5),
      );
      for (let s = 0; s < 10; s++) {
        g.fillStyle(s < ratings[k] ? (k === f.mainAttribute ? COLORS.gold : COLORS.accent) : COLORS.line, 1);
        g.fillRect(rx + 92 + s * 8, ry - 5, 6, 10);
      }
    });

    const mx = PANEL.x + 404;
    if (locked) {
      const u = unlockText(i18n, save.data, f);
      const lock = add(this.add.graphics());
      drawIcon(lock, 'lock', mx + 175, y0 + 140, 54, COLORS.gold);
      add(
        this.add
          .text(
            mx + 175,
            y0 + 190,
            t('select.locked'),
            textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.gold }),
          )
          .setOrigin(0.5),
      );
      add(
        this.add
          .text(mx + 175, y0 + 236, u.requirement, textStyle({ size: TYPE.body, align: 'center', wrap: 330 }))
          .setOrigin(0.5, 0),
      );
      const bar = add(this.add.graphics());
      bar.fillStyle(COLORS.line, 1);
      bar.fillRoundedRect(mx + 45, y0 + 300, 260, 14, 7);
      bar.fillStyle(COLORS.gold, 1);
      bar.fillRoundedRect(mx + 45, y0 + 300, Math.max(14, 260 * u.ratio), 14, 7);
      add(
        this.add
          .text(mx + 175, y0 + 328, u.progress, textStyle({ font: 'display', size: TYPE.small }))
          .setOrigin(0.5, 0),
      );
      add(
        this.add
          .text(
            mx + 175,
            y0 + 370,
            t('select.lockedHint'),
            textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, align: 'center', wrap: 330 }),
          )
          .setOrigin(0.5, 0),
      );
      return;
    }
    add(
      this.add.text(
        mx,
        y0,
        t('select.moves'),
        textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
      ),
    );
    MOVE_SLOTS.forEach((slot, i) => {
      const move = f.moves.find((m) => m.id === f.slots[slot])!;
      const my = y0 + 34 + i * 78;
      const icon = add(this.add.graphics());
      icon.fillStyle(COLORS.panelHi, 1);
      icon.fillRoundedRect(mx, my, 40, 40, 6);
      drawIcon(
        icon,
        iconForMove(move),
        mx + 20,
        my + 20,
        26,
        slot === 'ultimate' ? COLORS.energyFull : COLORS.white,
      );
      const chain = slot === 'light' ? ` ×${lightChainLength(f)}` : '';
      add(
        this.add.text(
          mx + 52,
          my - 2,
          `${t(`slots.${slot}`)} — ${t(move.nameKey)}${chain}`,
          textStyle({ size: TYPE.tiny, bold: true, wrap: 300 }),
        ),
      );
      const cost =
        move.energyCost > 0
          ? `${t('select.cost', { cost: move.energyCost })} · ${t('select.cooldown', { seconds: (move.cooldown / FPS).toFixed(1) })}${move.healthCost ? ` · ${t('select.healthCost', { cost: move.healthCost })}` : ''} — `
          : '';
      add(
        this.add.text(
          mx + 52,
          my + 18,
          `${cost}${t(move.descKey)}`,
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 300 }),
        ),
      );
    });
  }

  override update(): void {
    this.clock++;
    for (const c of this.cards) c.tick(this.clock);
    if (!this.preview) return;
    const period = 70;
    const step = Math.floor(this.clock / period) % this.showcase.length;
    const name = this.showcase[step];
    const t = (this.clock % period) / period;
    this.preview.drawAnimation(
      GRID.x0 + CARD_W + GRID.gap,
      GAME_HEIGHT - 84,
      1,
      name,
      name === 'idle' ? this.clock / 64 : t * 1.1,
      this.clock,
      name !== 'idle',
    );
  }
}
