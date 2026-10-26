import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { getFighter } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { isUnlocked, levelForXp } from '@/systems/ProgressionManager';
import { getServices } from '@/systems/Services';
import { Button } from '@/ui/Button';
import { createLogo } from '@/ui/Logo';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { showToast } from '@/ui/Toast';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { BattleData, SelectData } from './SceneData';

const HERO_SWAP_MS = 6000;

/** Main menu: logo, animated background, featured fighter, and real navigation. */
export class MenuScene extends Phaser.Scene {
  private hero: FighterRenderer | null = null;
  private heroIndex = 0;
  private clock = 0;
  private heroName!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    const { i18n, save, audio } = getServices(this);
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    createMenuBackground(this);
    this.clock = 0;

    createLogo(this, 400, 150, 'horizontal');
    this.add
      .text(
        400,
        238,
        t('game.tagline').toUpperCase(),
        textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(4);

    // Featured fighter (cycles through unlocked fighters).
    const unlocked = FIGHTERS.filter((f) => isUnlocked(save.data, f));
    this.heroIndex = 0;
    this.hero = new FighterRenderer(this, unlocked[0], 1.6);
    this.hero.setDepth(5);
    this.heroName = this.add
      .text(
        1010,
        660,
        '',
        textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.primary, stroke: true }),
      )
      .setOrigin(0.5)
      .setDepth(6);
    this.updateHeroName(unlocked[0].id);
    this.time.addEvent({
      delay: HERO_SWAP_MS,
      loop: true,
      callback: () => {
        this.heroIndex = (this.heroIndex + 1) % unlocked.length;
        const next = unlocked[this.heroIndex];
        this.hero?.destroy();
        this.hero = new FighterRenderer(this, next, 1.6).setDepth(5);
        this.updateHeroName(next.id);
      },
    });

    const ladder = save.data.progress.ladder;
    const items: Array<{ id: string; label: string; action: () => void }> = [];
    if (ladder) {
      const stage = ladder.stages[ladder.stage];
      items.push({
        id: 'menu-continue',
        label: t('menu.continue'),
        action: () => {
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
      });
    }
    items.push(
      {
        id: 'menu-play',
        label: t('menu.play'),
        action: () => goTo(this, SCENES.select, { mode: 'arcade' } satisfies SelectData),
      },
      {
        id: 'menu-tournament',
        label:
          save.data.tournament?.status === 'active' ? t('menu.tournamentContinue') : t('menu.tournament'),
        action: () => goTo(this, SCENES.tournament),
      },
      { id: 'menu-progression', label: t('menu.progression'), action: () => goTo(this, SCENES.progression) },
      { id: 'menu-tutorial', label: t('menu.howToPlay'), action: () => goTo(this, SCENES.tutorial) },
      {
        id: 'menu-settings',
        label: t('menu.settings'),
        action: () => goTo(this, SCENES.settings, { returnTo: SCENES.menu, overlay: false }),
      },
      { id: 'menu-credits', label: t('menu.credits'), action: () => goTo(this, SCENES.credits) },
    );
    const spacing = items.length > 7 ? 54 : 58;
    const startY = items.length > 7 ? 292 : 312;
    const buttons = items.map(
      (it, i) =>
        new Button(this, 400, startY + i * spacing, {
          id: it.id,
          label: it.label,
          onClick: it.action,
          height: 50,
        }),
    );
    buttons.forEach((b, i) => {
      b.setAlpha(0).setX(340);
      this.tweens.add({ targets: b, alpha: 1, x: 400, delay: 60 * i, duration: 220, ease: 'Cubic.Out' });
    });
    new MenuNavigator(this, buttons);

    const p = save.data.progress;
    this.add
      .text(
        24,
        GAME_HEIGHT - 24,
        `${t('common.level', { level: levelForXp(p.xp) })}${p.activeTitle ? ` · ${t(p.activeTitle)}` : ''} · ${t('menu.record', { wins: p.wins, cleared: p.laddersCleared })}`,
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }),
      )
      .setOrigin(0, 1);
    this.add
      .text(
        GAME_WIDTH - 24,
        GAME_HEIGHT - 24,
        t('common.navHint'),
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.muted }),
      )
      .setOrigin(1, 1);
    if (!audio.unlocked) {
      const hint = this.add
        .text(
          400,
          GAME_HEIGHT - 60,
          t('common.audioHint'),
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.gold }),
        )
        .setOrigin(0.5);
      this.tweens.add({ targets: hint, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      const clear = (): void => {
        hint.destroy();
        audio.playMusic('menu');
      };
      this.input.once('pointerdown', clear);
      this.input.keyboard?.once('keydown', clear);
    }
    audio.playMusic('menu');

    const issue = save.lastIssue;
    if (issue === 'corrupt') showToast(this, t('errors.saveCorrupt'), COLORS.danger, 4000);
    else if (issue === 'future_version') showToast(this, t('errors.saveFuture'), COLORS.gold, 4000);
    save.lastIssue = 'none';
    if (getServices(this).assets.missing.size > 0) showToast(this, t('errors.assetFallback'), COLORS.gold);
    fadeIn(this);
  }

  private updateHeroName(id: string): void {
    const f = getFighter(id);
    const { i18n } = getServices(this);
    this.heroName.setText(`${i18n.t(f.nameKey)} — ${i18n.t(f.titleKey)}`).setAlpha(0);
    this.tweens.add({ targets: this.heroName, alpha: 1, duration: 400 });
  }

  override update(): void {
    this.clock++;
    this.hero?.drawAnimation(1010, 600, -1, 'idle', this.clock / 64, this.clock);
  }
}
