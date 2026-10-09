import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { computeRatings, lightChainLength } from '@/characters/CharacterStats';
import { FPS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { isUnlocked, unlockProgress } from '@/systems/ProgressionManager';
import { getServices } from '@/systems/Services';
import type { Difficulty, FighterData, MoveSlot, RatingKey } from '@/types';
import { Button, type Focusable } from '@/ui/Button';
import { CharacterCard } from '@/ui/CharacterCard';
import { drawIcon, iconForMove } from '@/ui/Icons';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { BattleData, SelectData } from './SceneData';

const RATING_KEYS: RatingKey[] = ['power', 'defense', 'speed', 'range', 'mobility', 'technique'];
const MOVE_SLOTS: MoveSlot[] = ['light', 'heavy', 'skill', 'special', 'ultimate'];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

/** Roster screen. In play mode it starts the arcade ladder; in browse mode it is a codex. */
export class CharacterSelectScene extends Phaser.Scene {
  private browse = false;
  private cards: CharacterCard[] = [];
  private index = 0;
  private clock = 0;
  private preview: FighterRenderer | null = null;
  private detail!: Phaser.GameObjects.Container;
  private fightButton: Button | null = null;
  private showcase: string[] = ['idle'];

  constructor() {
    super(SCENES.select);
  }

  init(data: SelectData): void {
    this.browse = data?.browse ?? false;
    this.cards = [];
    this.index = 0;
    this.clock = 0;
    this.preview = null;
    this.fightButton = null;
  }

  create(): void {
    const { i18n, save, settings } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    createMenuBackground(this, COLORS.cyan);
    this.add
      .text(
        GAME_WIDTH / 2,
        34,
        this.browse ? t('select.browseTitle') : t('select.title'),
        textStyle({ font: 'display', size: TYPE.h2, stroke: true }),
      )
      .setOrigin(0.5);

    FIGHTERS.forEach((f, i) => {
      const locked = !isUnlocked(save.data, f);
      const prog = unlockProgress(save.data, f);
      const reason =
        f.unlock.type === 'wins'
          ? t('select.unlockWins', { count: prog.required, current: prog.current })
          : '';
      const card = new CharacterCard(
        this,
        GAME_WIDTH / 2 + (i - (FIGHTERS.length - 1) / 2) * 224,
        172,
        f,
        t(f.nameKey),
        t(`archetypes.${f.archetype}`),
        locked,
        reason,
        () => {
          if (this.index === i) this.confirm();
          else this.select(i);
        },
      );
      this.cards.push(card);
    });

    this.detail = this.add.container(0, 0);
    const back = new Button(this, 150, GAME_HEIGHT - 44, {
      id: 'select-back',
      label: t('common.back'),
      width: 220,
      height: 50,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });

    const cardsRow: Focusable = {
      enabled: true,
      visible: true,
      setFocused: (f) => this.cards[this.index]?.setSelected(f || true),
      activate: () => this.confirm(),
      adjust: (d) => this.select((this.index + d + this.cards.length) % this.cards.length),
    };
    const items: Focusable[] = [cardsRow];
    if (!this.browse) {
      const diffIndex = DIFFICULTIES.indexOf(settings.settings.difficulty);
      const diffLabel = (d: Difficulty): string => `${t('select.difficulty')}: ${t(`difficulty.${d}`)}  ◀ ▶`;
      let current = diffIndex;
      const diff = new Button(this, 760, GAME_HEIGHT - 44, {
        id: 'select-difficulty',
        label: diffLabel(DIFFICULTIES[current]),
        width: 400,
        height: 50,
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
      this.fightButton = new Button(this, 1110, GAME_HEIGHT - 44, {
        id: 'select-fight',
        label: t('select.fight'),
        width: 240,
        height: 54,
        onClick: () => this.confirm(),
      });
      items.push(diff, this.fightButton);
    }
    items.push(back);
    new MenuNavigator(this, items, { onBack: () => goTo(this, SCENES.menu) });
    this.select(0);
    fadeIn(this);
  }

  private select(i: number): void {
    this.index = i;
    this.cards.forEach((c, j) => c.setSelected(j === i));
    const f = this.cards[i].fighter;
    this.preview?.destroy();
    this.preview = new FighterRenderer(this, f, 1.45).setDepth(5);
    if (this.cards[i].locked) {
      this.preview.setPalette({
        primary: 0x0d0b14,
        secondary: 0x0d0b14,
        accent: 0x15121e,
        skin: 0x0d0b14,
        hair: 0x0d0b14,
        outline: 0x2a2438,
        energy: 0x2a2438,
      });
    }
    this.fightButton?.setEnabled(!this.cards[i].locked);
    const anim = (slot: MoveSlot): string => f.moves.find((m) => m.id === f.slots[slot])?.animation ?? 'idle';
    this.showcase = ['idle', anim('light'), anim('heavy'), anim('special'), 'idle', anim('crouchHeavy')];
    this.renderDetail(f, this.cards[i].locked);
    getServices(this).audio.play('ui_hover');
  }

  private confirm(): void {
    const card = this.cards[this.index];
    const { audio, progression, save } = getServices(this);
    if (this.browse) return;
    if (card.locked) {
      audio.play('ui_error');
      this.tweens.add({ targets: card, x: card.x + 8, duration: 40, yoyo: true, repeat: 3 });
      return;
    }
    audio.play('ui_click');
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
    const { i18n } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    this.detail.removeAll(true);
    const x0 = 430;
    const y0 = 290;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.88);
    panel.fillRoundedRect(x0 - 20, y0 - 22, 840, 384, 12);
    panel.lineStyle(2, COLORS.line, 1);
    panel.strokeRoundedRect(x0 - 20, y0 - 22, 840, 384, 12);
    panel.fillStyle(f.palette.primary, 1);
    panel.fillRect(x0 - 20, y0 - 22, 6, 384);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.detail.add(o);
      return o;
    };
    add(panel);
    add(this.add.text(x0, y0, t(f.nameKey), textStyle({ font: 'display', size: TYPE.h2 })));
    add(this.add.text(x0, y0 + 46, t(f.titleKey), textStyle({ size: TYPE.body, color: TEXT_COLORS.gold })));
    const meta = [
      `${t('select.archetype')}: ${t(`archetypes.${f.archetype}`)}  ·  ${t('select.mainAttribute')}: ${t(`ratings.${f.mainAttribute}`)}`,
      `${t('select.health', { value: f.stats.health })}  ·  ${t('select.style')}: ${t(f.styleKey)}`,
    ];
    const metaText = add(
      this.add.text(x0, y0 + 80, meta, textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 370 })),
    );
    const bio = add(
      this.add.text(
        x0,
        metaText.y + metaText.height + 10,
        t(f.bioKey),
        textStyle({ size: TYPE.small, wrap: 370 }),
      ),
    );
    add(
      this.add.text(
        x0,
        bio.y + bio.height + 8,
        `${t('select.weakness')}: ${t(f.weaknessKey)}`,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.danger, wrap: 370 }),
      ),
    );

    // Ratings derived from the real data (bars + numbers).
    const ratings = computeRatings(f);
    const g = add(this.add.graphics());
    RATING_KEYS.forEach((k, i) => {
      const ry = y0 + 300 + Math.floor(i / 2) * 22;
      const rx = x0 + (i % 2) * 190;
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

    // Move list.
    const mx = x0 + 400;
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
      const my = y0 + 36 + i * 62;
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
          my - 4,
          `${t(`slots.${slot}`)} — ${t(move.nameKey)}${chain}`,
          textStyle({ size: TYPE.tiny, bold: true, wrap: 350 }),
        ),
      );
      const cost =
        move.energyCost > 0
          ? `${t('select.cost', { cost: move.energyCost })} · ${t('select.cooldown', { seconds: (move.cooldown / FPS).toFixed(1) })} — `
          : '';
      add(
        this.add.text(
          mx + 52,
          my + 16,
          `${cost}${t(move.descKey)}`,
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 350 }),
        ),
      );
    });
    if (locked) {
      const cover = add(this.add.graphics());
      cover.fillStyle(COLORS.bg, 0.86);
      cover.fillRoundedRect(mx - 10, y0 + 26, 400, 320, 8);
      const prog = unlockProgress(getServices(this).save.data, f);
      add(
        this.add
          .text(
            mx + 190,
            y0 + 180,
            `${t('select.locked')}\n${t('select.unlockWins', { count: prog.required, current: prog.current })}`,
            textStyle({
              font: 'display',
              size: TYPE.small,
              color: TEXT_COLORS.gold,
              align: 'center',
              wrap: 360,
            }),
          )
          .setOrigin(0.5),
      );
    }
  }

  override update(): void {
    this.clock++;
    for (const c of this.cards) c.tick(this.clock);
    if (!this.preview) return;
    // Showcase loop: idle, light, heavy...
    const period = 70;
    const step = Math.floor(this.clock / period) % this.showcase.length;
    const name = this.showcase[step];
    const t = (this.clock % period) / period;
    this.preview.drawAnimation(
      215,
      640,
      1,
      name,
      name === 'idle' ? this.clock / 64 : t * 1.1,
      this.clock,
      name !== 'idle',
    );
  }
}
