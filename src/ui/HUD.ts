import Phaser from 'phaser';
import { GAME_WIDTH, MATCH } from '@/config/gameConfig';
import type { Side } from '@/characters/Character';
import type { Match } from '@/core/Match';
import type { MatchEvents } from '@/core/MatchEvents';
import { keyLabel } from '@/input/ControlMapping';
import type { LocalizationManager } from '@/systems/LocalizationManager';
import type { ActionId, ControlBindings, MoveSlot } from '@/types';
import { EnergyBar } from './EnergyBar';
import { HealthBar } from './HealthBar';
import { SkillSlot } from './SkillSlot';
import { COLORS, DEPTH, TEXT_COLORS, TYPE, textStyle } from './theme';

const SLOT_ACTIONS: Array<[MoveSlot, ActionId]> = [
  ['skill', 'skill'],
  ['special', 'special'],
  ['ultimate', 'ultimate'],
];

interface SideWidgets {
  health: HealthBar;
  energy: EnergyBar;
  name: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Graphics;
  combo: Phaser.GameObjects.Text;
  comboDamage: Phaser.GameObjects.Text;
}

/**
 * Battle HUD. Purely presentational: it reads the match each frame and reacts to match events
 * (combo counter, banners). Layout adapts when touch controls take the bottom of the screen.
 */
export class HUD {
  private readonly sides: Record<Side, SideWidgets>;
  private readonly slots: SkillSlot[] = [];
  private readonly timer: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Text;
  private readonly subBanner: Phaser.GameObjects.Text;
  private readonly unsub: Array<() => void> = [];
  private comboTimers: Record<Side, number> = { p1: 0, p2: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly match: Match,
    private readonly i18n: LocalizationManager,
    bindings: Readonly<ControlBindings>,
    touchLayout: boolean,
  ) {
    const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as { setDepth?: (d: number) => void }).setDepth?.(DEPTH.hud);
      layer.add(o);
      return o;
    };
    const makeSide = (side: Side): SideWidgets => {
      const f = match.fighter(side);
      const left = side === 'p1';
      const inner = left ? GAME_WIDTH / 2 - 70 : GAME_WIDTH / 2 + 70;
      const health = add(new HealthBar(scene, inner, 34, 470, 26, left, t('battle.danger')));
      const tag = side === 'p1' ? t('battle.you') : t('battle.cpu');
      const name = add(
        scene.add
          .text(
            left ? 60 : GAME_WIDTH - 60,
            78,
            `${t(f.data.nameKey)}  ·  ${tag}`,
            textStyle({ font: 'display', size: TYPE.body, stroke: true }),
          )
          .setOrigin(left ? 0 : 1, 0.5),
      );
      const pips = add(scene.add.graphics());
      const energyY = touchLayout ? 112 : 684;
      const energy = add(
        new EnergyBar(scene, left ? 60 : GAME_WIDTH - 60, energyY, 260, !left, t('battle.ultimateReady')),
      );
      const combo = add(
        scene.add
          .text(
            left ? 70 : GAME_WIDTH - 70,
            230,
            '',
            textStyle({ font: 'display', size: TYPE.h1, color: TEXT_COLORS.gold, stroke: true }),
          )
          .setOrigin(left ? 0 : 1, 0.5)
          .setAlpha(0),
      );
      const comboDamage = add(
        scene.add
          .text(
            left ? 74 : GAME_WIDTH - 74,
            275,
            '',
            textStyle({ size: TYPE.body, bold: true, stroke: true }),
          )
          .setOrigin(left ? 0 : 1, 0.5)
          .setAlpha(0),
      );
      health.setRatio(1, true);
      return { health, energy, name, pips, combo, comboDamage };
    };
    this.sides = { p1: makeSide('p1'), p2: makeSide('p2') };

    // Timer
    const timerBg = add(scene.add.graphics());
    timerBg.fillStyle(0x000000, 0.65);
    timerBg.fillRoundedRect(GAME_WIDTH / 2 - 52, 14, 104, 70, 10);
    timerBg.lineStyle(2, COLORS.line, 1);
    timerBg.strokeRoundedRect(GAME_WIDTH / 2 - 52, 14, 104, 70, 10);
    this.timer = add(
      scene.add
        .text(GAME_WIDTH / 2, 49, '99', textStyle({ font: 'display', size: TYPE.h2 + 4 }))
        .setOrigin(0.5),
    );

    this.banner = add(
      scene.add
        .text(
          GAME_WIDTH / 2,
          300,
          '',
          textStyle({ font: 'display', size: TYPE.hero, stroke: true, align: 'center' }),
        )
        .setOrigin(0.5)
        .setAlpha(0),
    );
    this.subBanner = add(
      scene.add
        .text(
          GAME_WIDTH / 2,
          380,
          '',
          textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.gold, stroke: true }),
        )
        .setOrigin(0.5)
        .setAlpha(0),
    );

    // Player skill slots
    const slotY = touchLayout ? 168 : 622;
    SLOT_ACTIONS.forEach(([slot, action], i) => {
      const move = match.p1.moveForSlot(slot);
      const s = add(new SkillSlot(scene, 92 + i * 74, slotY, move, this.keyText(bindings, action)));
      this.slots.push(s);
    });

    this.bindEvents();
    this.update(0);
  }

  private keyText(bindings: Readonly<ControlBindings>, action: ActionId): string {
    const label = keyLabel(bindings[action][0] ?? '');
    return label.startsWith('@') ? this.i18n.t(label.slice(1)) : label;
  }

  private bindEvents(): void {
    const ev = this.match.events;
    const on = <K extends keyof MatchEvents>(k: K, fn: (p: MatchEvents[K]) => void): void => {
      this.unsub.push(ev.on(k, fn));
    };
    const t = (k: string, p?: Record<string, string | number>): string => this.i18n.t(k, p);
    on('hit', (e) => {
      if (e.combo >= 2) this.showCombo(e.attacker, e.combo);
    });
    on('comboEnd', (e) => this.finishCombo(e.attacker, e.damage));
    on('roundStart', (e) => {
      const final =
        this.match.wins[0] === this.match.roundsToWin - 1 &&
        this.match.wins[1] === this.match.roundsToWin - 1;
      if (this.match.mode === 'training') {
        this.showBanner(t('battle.training'), '', 1200, TEXT_COLORS.cyan);
        return;
      }
      this.showBanner(final ? t('battle.finalRound') : t('battle.round', { round: e.round }), '', 700);
    });
    on('countdown', (e) => this.showBanner(String(e.value), '', 600));
    on('fight', () => {
      if (this.match.mode !== 'training') this.showBanner(t('battle.fight'), '', 700, TEXT_COLORS.accent);
    });
    on('ko', (e) => {
      const text =
        e.reason === 'time'
          ? t('battle.timeUp')
          : e.reason === 'double_ko'
            ? t('battle.doubleKo')
            : t('battle.ko');
      const winner = e.winner
        ? t('battle.wins', { name: t(this.match.fighter(e.winner).data.nameKey) })
        : t('battle.draw');
      this.showBanner(text, winner, 2200, TEXT_COLORS.danger);
    });
  }

  private showBanner(text: string, sub: string, ms: number, color: string = TEXT_COLORS.primary): void {
    const b = this.banner;
    this.scene.tweens.killTweensOf([b, this.subBanner]);
    b.setText(text).setColor(color).setAlpha(1).setScale(1.6);
    this.scene.tweens.add({ targets: b, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: b, alpha: 0, delay: ms, duration: 250 });
    this.subBanner.setText(sub).setAlpha(sub ? 1 : 0);
    if (sub) this.scene.tweens.add({ targets: this.subBanner, alpha: 0, delay: ms, duration: 250 });
  }

  private showCombo(side: Side, count: number): void {
    const w = this.sides[side];
    this.scene.tweens.killTweensOf([w.combo, w.comboDamage]);
    w.combo.setText(this.i18n.t('battle.hits', { count })).setAlpha(1).setScale(1.25);
    this.scene.tweens.add({ targets: w.combo, scale: 1, duration: 120, ease: 'Back.Out' });
    this.comboTimers[side] = 1.6;
  }

  private finishCombo(side: Side, damage: number): void {
    const w = this.sides[side];
    w.comboDamage.setText(this.i18n.t('battle.damage', { damage })).setAlpha(1);
    this.comboTimers[side] = 1.2;
  }

  /** Called every rendered frame with the elapsed seconds. */
  update(dt: number): void {
    for (const side of ['p1', 'p2'] as Side[]) {
      const f = this.match.fighter(side);
      const w = this.sides[side];
      w.health.setRatio(f.health / f.maxHealth);
      w.health.tick(dt);
      w.energy.setValue(f.energy, f.skills.maxEnergy);
      w.energy.tick(dt);
      this.drawPips(side, w.pips);
      if (this.comboTimers[side] > 0) {
        this.comboTimers[side] -= dt;
        if (this.comboTimers[side] <= 0) {
          this.scene.tweens.add({ targets: [w.combo, w.comboDamage], alpha: 0, duration: 250 });
        }
      }
    }
    for (const s of this.slots) s.refresh(this.match.p1, dt);
    this.timer.setText(this.match.mode === 'training' ? '∞' : String(this.match.secondsLeft));
    this.timer.setColor(
      this.match.secondsLeft <= 10 && this.match.mode !== 'training'
        ? TEXT_COLORS.danger
        : TEXT_COLORS.primary,
    );
  }

  private drawPips(side: Side, g: Phaser.GameObjects.Graphics): void {
    if (this.match.mode === 'training') return;
    g.clear();
    const wins = this.match.wins[side === 'p1' ? 0 : 1];
    const left = side === 'p1';
    for (let i = 0; i < MATCH.roundsToWin; i++) {
      const x = left ? GAME_WIDTH / 2 - 90 - i * 26 : GAME_WIDTH / 2 + 90 + i * 26;
      g.fillStyle(0x000000, 0.7);
      g.fillCircle(x, 78, 10);
      // Filled star-like diamond for a won round, hollow ring otherwise (shape, not only colour).
      if (i < wins) {
        g.fillStyle(COLORS.gold, 1);
        g.fillTriangle(x, 69, x + 8, 78, x - 8, 78);
        g.fillTriangle(x, 87, x + 8, 78, x - 8, 78);
      } else {
        g.lineStyle(2, COLORS.lineHi, 1);
        g.strokeCircle(x, 78, 6);
      }
    }
  }

  setVisible(v: boolean): void {
    this.layer.setVisible(v);
  }

  destroy(): void {
    for (const u of this.unsub) u();
  }
}
