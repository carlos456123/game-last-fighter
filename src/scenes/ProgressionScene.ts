import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { FIGHTERS } from '@/data/characters';
import { ACHIEVEMENTS } from '@/data/progression/achievements';
import { MASTERY, getSpec, specsFor } from '@/data/progression/specializations';
import { chooseSpecialization, levelProgress, masteryOf } from '@/systems/ProgressionManager';
import { getServices } from '@/systems/Services';
import type { FighterData } from '@/types';
import { Button, type Focusable } from '@/ui/Button';
import { drawIcon } from '@/ui/Icons';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { showToast } from '@/ui/Toast';
import { fadeIn, goTo } from '@/ui/Transitions';
import { unlockText } from '@/ui/UnlockText';
import { Selector } from '@/ui/Widgets';
import type { SelectData } from './SceneData';

type Tab = 'summary' | 'fighters' | 'achievements';
const TABS: Tab[] = ['summary', 'fighters', 'achievements'];

/** Player progression hub: level and XP, statistics, recent rewards, fighter mastery, specializations and achievements. */
export class ProgressionScene extends Phaser.Scene {
  private tab = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Button[] = [];
  private nav!: MenuNavigator;
  private back!: Button;
  private codex!: Button;
  private detailText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.progression);
  }

  init(data?: { tab?: number }): void {
    this.tab = data?.tab ?? 0;
    this.content = [];
  }

  create(): void {
    createMenuBackground(this, COLORS.cyan);
    this.add
      .text(
        GAME_WIDTH / 2,
        36,
        this.tr('progression.title'),
        textStyle({ font: 'display', size: TYPE.h2, stroke: true }),
      )
      .setOrigin(0.5);
    this.tabButtons = TABS.map(
      (id, i) =>
        new Button(this, GAME_WIDTH / 2 + (i - 1) * 260, 96, {
          id: `progression-tab-${id}`,
          label: this.tr(`progression.${id}`),
          width: 240,
          height: 44,
          fontSize: TYPE.small,
          variant: 'secondary',
          onClick: () => this.showTab(i),
        }),
    );
    this.back = new Button(this, 150, GAME_HEIGHT - 40, {
      id: 'progression-back',
      label: this.tr('common.back'),
      width: 220,
      height: 46,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });
    this.codex = new Button(this, GAME_WIDTH - 170, GAME_HEIGHT - 40, {
      id: 'progression-codex',
      label: this.tr('progression.codex'),
      width: 280,
      height: 46,
      onClick: () => goTo(this, SCENES.select, { mode: 'browse' } satisfies SelectData),
    });
    this.nav = new MenuNavigator(this, [], { onBack: () => goTo(this, SCENES.menu) });
    this.showTab(this.tab);
    fadeIn(this);
  }

  private tr(k: string, p?: Record<string, string | number>): string {
    return getServices(this).i18n.t(k, p);
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.content.push(o);
    return o;
  }

  private tabRow(): Focusable {
    return {
      enabled: true,
      visible: true,
      setFocused: (f) => this.tabButtons.forEach((b, i) => b.setFocused(f && i === this.tab)),
      activate: () => this.showTab((this.tab + 1) % TABS.length),
      adjust: (d) => this.showTab((this.tab + d + TABS.length) % TABS.length),
    };
  }

  private showTab(i: number): void {
    this.tab = i;
    for (const o of this.content) o.destroy();
    this.content = [];
    this.detailText = null;
    this.tabButtons.forEach((b, j) => {
      b.setSelected(j === i);
      b.setFocused(false);
    });
    const rows =
      TABS[i] === 'summary'
        ? this.buildSummary()
        : TABS[i] === 'fighters'
          ? this.buildFighters()
          : this.buildAchievements();
    this.nav.setItems([this.tabRow(), ...rows, this.codex, this.back]);
    this.nav.focus(0);
  }

  private buildSummary(): Focusable[] {
    const { save } = getServices(this);
    const p = save.data.progress;
    const st = save.data.stats;
    const lp = levelProgress(p.xp);
    const g = this.track(this.add.graphics());
    g.fillStyle(COLORS.panel, 0.9);
    g.fillRoundedRect(80, 140, 540, 460, 12);
    g.fillRoundedRect(660, 140, 540, 460, 12);
    this.track(
      this.add.text(
        110,
        160,
        this.tr('common.level', { level: lp.level }),
        textStyle({ font: 'display', size: TYPE.h1, color: TEXT_COLORS.gold }),
      ),
    );
    g.fillStyle(COLORS.line, 1);
    g.fillRoundedRect(110, 240, 480, 18, 9);
    g.fillStyle(COLORS.gold, 1);
    g.fillRoundedRect(110, 240, Math.max(18, 480 * lp.ratio), 18, 9);
    this.track(
      this.add.text(
        110,
        266,
        this.tr('progression.xpBar', { current: lp.current, needed: lp.needed, total: p.xp }),
        textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
      ),
    );
    const rows: Array<[string, string | number]> = [
      ['progression.stats.wins', `${p.wins} / ${p.losses}`],
      ['progression.stats.arcadeStreak', `${p.arcadeStreak} (${p.bestArcadeStreak})`],
      ['progression.stats.flawless', p.flawlessWins],
      ['progression.stats.perfectDodges', p.perfectDodges],
      ['progression.stats.counters', st.counters],
      ['progression.stats.bestCombo', st.bestCombo],
      ['progression.stats.shadow', p.shadowWins],
      ['progression.stats.tournaments', `${p.tournamentsWon} / ${p.tournamentEditions}`],
      ['progression.stats.ladders', p.laddersCleared],
      ['progression.stats.time', `${Math.floor(st.playSeconds / 60)} min`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 310 + i * 28;
      this.track(this.add.text(110, y, this.tr(k), textStyle({ size: TYPE.small, color: TEXT_COLORS.dim })));
      this.track(
        this.add.text(590, y, String(v), textStyle({ font: 'display', size: TYPE.small })).setOrigin(1, 0),
      );
    });

    // Recent rewards (newest first)
    this.track(
      this.add.text(
        690,
        160,
        this.tr('progression.recent'),
        textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
      ),
    );
    const recent = [...p.recentRewards].reverse().slice(0, 8);
    if (recent.length === 0)
      this.track(
        this.add.text(
          690,
          200,
          this.tr('progression.noRewards'),
          textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
        ),
      );
    recent.forEach((r, i) => {
      const params = { ...r.params };
      if (typeof params.fighter === 'string') params.fighter = this.tr(`fighters.${params.fighter}.name`);
      if (typeof params.id === 'string') params.id = this.tr(`achievements.${params.id}.name`);
      if (typeof params.level === 'number') params.level = this.tr(`mastery.level${params.level}`);
      this.track(
        this.add.text(
          690,
          200 + i * 30,
          `• ${this.tr(r.key, params)}`,
          textStyle({ size: TYPE.tiny, wrap: 480 }),
        ),
      );
    });

    // Title selector (cosmetic reward from achievements).
    const options = [
      { value: '', label: this.tr('progression.noTitle') },
      ...p.titles.map((t) => ({ value: t, label: this.tr(t) })),
    ];
    const current = Math.max(
      0,
      options.findIndex((o) => o.value === (p.activeTitle ?? '')),
    );
    const selector = this.track(
      new Selector(
        this,
        GAME_WIDTH / 2,
        636,
        this.tr('progression.titleLabel'),
        'progression-title',
        options,
        current,
        (v) => {
          save.update((d) => (d.progress.activeTitle = v || null));
        },
        46,
      ),
    );
    return [selector];
  }

  private buildFighters(): Focusable[] {
    const { save } = getServices(this);
    const rows: Focusable[] = [];
    FIGHTERS.forEach((f, i) => {
      const y = 152 + i * 44;
      const unlock = unlockText(getServices(this).i18n, save.data, f);
      const m = masteryOf(save.data, f.id);
      const specs = specsFor(f.id);
      const label = unlock.unlocked
        ? `${this.tr(f.nameKey)} · ${this.tr(`mastery.level${m.level}`)}`
        : `🔒 ${this.tr(f.nameKey)} · ${unlock.progress}`;
      let options: Array<{ value: string; label: string }>;
      if (!unlock.unlocked) options = [{ value: '', label: this.tr('progression.locked') }];
      else if (m.level < 2) options = [{ value: '', label: this.tr('progression.needMastery') }];
      else options = specs.map((s) => ({ value: s.id, label: this.tr(s.nameKey) }));
      const current = Math.max(
        0,
        options.findIndex((o) => o.value === m.spec),
      );
      const row = this.track(
        new Selector(
          this,
          GAME_WIDTH / 2,
          y,
          label,
          `progression-fighter-${f.id}`,
          options,
          current,
          (v) => {
            if (!v) return;
            let ok = false;
            save.update((d) => (ok = chooseSpecialization(d, f.id, v)));
            if (ok)
              showToast(
                this,
                this.tr('progression.specChosen', { spec: this.tr(getSpec(v)!.nameKey) }),
                COLORS.success,
              );
            this.describe(f);
          },
          40,
        ),
      );
      row.on('focused', () => this.describe(f));
      rows.push(row);
    });
    this.detailText = this.track(
      this.add
        .text(
          GAME_WIDTH / 2,
          560,
          '',
          textStyle({ size: TYPE.tiny, align: 'center', wrap: 980, color: TEXT_COLORS.dim }),
        )
        .setOrigin(0.5, 0),
    );
    this.describe(FIGHTERS[0]);
    return rows;
  }

  /** Shows mastery progress and both specializations of a fighter (or how to unlock it). */
  private describe(f: FighterData): void {
    if (!this.detailText) return;
    const { save, i18n } = getServices(this);
    const unlock = unlockText(i18n, save.data, f);
    if (!unlock.unlocked) {
      this.detailText.setText(`${this.tr(f.nameKey)}: ${unlock.requirement} (${unlock.progress})`);
      return;
    }
    const m = masteryOf(save.data, f.id);
    const next = MASTERY.thresholds[Math.min(m.level, MASTERY.thresholds.length - 1)];
    const progress =
      m.level >= MASTERY.maxLevel
        ? this.tr('progression.masteryMax')
        : this.tr('progression.masteryNext', { xp: m.xp, next });
    const specs = specsFor(f.id)
      .map((s) => `${s.id === m.spec ? '▶ ' : ''}${this.tr(s.nameKey)}: ${this.tr(s.descKey)}`)
      .join('\n');
    this.detailText.setText(`${progress}\n${specs}`);
  }

  private buildAchievements(): Focusable[] {
    const { save } = getServices(this);
    const g = this.track(this.add.graphics());
    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 90 + col * 560;
      const y = 140 + row * 64;
      const doneAt = save.data.progress.achievements[a.id];
      const done = doneAt !== undefined;
      const value = Math.min(a.target, a.progress(save.data));
      g.fillStyle(done ? COLORS.panelHi : COLORS.panel, 0.92);
      g.fillRoundedRect(x, y, 540, 56, 8);
      g.lineStyle(2, done ? COLORS.success : COLORS.line, 1);
      g.strokeRoundedRect(x, y, 540, 56, 8);
      drawIcon(g, done ? 'ultimate' : 'lock', x + 28, y + 28, 26, done ? COLORS.gold : COLORS.lineHi);
      this.track(
        this.add.text(
          x + 54,
          y + 6,
          this.tr(a.nameKey),
          textStyle({
            font: 'display',
            size: TYPE.tiny,
            color: done ? TEXT_COLORS.gold : TEXT_COLORS.primary,
          }),
        ),
      );
      this.track(
        this.add.text(
          x + 54,
          y + 28,
          this.tr(a.descKey),
          textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 330 }),
        ),
      );
      const reward = `+${a.xp} EXP${a.title ? ` · ${this.tr(a.title)}` : ''}`;
      this.track(
        this.add
          .text(x + 528, y + 6, reward, textStyle({ size: TYPE.tiny, color: TEXT_COLORS.cyan }))
          .setOrigin(1, 0),
      );
      const status = done ? `✓ ${new Date(doneAt).toLocaleDateString('pt-BR')}` : `${value}/${a.target}`;
      this.track(
        this.add
          .text(
            x + 528,
            y + 30,
            status,
            textStyle({
              size: TYPE.tiny,
              bold: true,
              color: done ? TEXT_COLORS.success : TEXT_COLORS.primary,
            }),
          )
          .setOrigin(1, 0),
      );
    });
    return [];
  }
}
