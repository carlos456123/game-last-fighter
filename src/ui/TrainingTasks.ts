import type Phaser from 'phaser';
import type { Match } from '@/core/Match';
import type { MatchEvents } from '@/core/MatchEvents';
import type { LocalizationManager } from '@/systems/LocalizationManager';
import { COLORS, DEPTH, TEXT_COLORS, TYPE, textStyle } from './theme';

type TaskId =
  'move' | 'jump' | 'crouch' | 'light' | 'heavy' | 'combo' | 'block' | 'dodge' | 'skill' | 'ultimate';

const TASKS: Array<{ id: TaskId; key: string }> = [
  { id: 'move', key: 'tutorial.taskMove' },
  { id: 'jump', key: 'tutorial.taskJump' },
  { id: 'crouch', key: 'tutorial.taskCrouch' },
  { id: 'light', key: 'tutorial.taskLight' },
  { id: 'heavy', key: 'tutorial.taskHeavy' },
  { id: 'combo', key: 'tutorial.taskCombo' },
  { id: 'block', key: 'tutorial.taskBlock' },
  { id: 'dodge', key: 'tutorial.taskDodge' },
  { id: 'skill', key: 'tutorial.taskSkill' },
  { id: 'ultimate', key: 'tutorial.taskUltimate' },
];

const X = 930;
const Y0 = 170;
const ROW = 32;

/** Interactive tutorial checklist that ticks tasks off as the player really performs them. */
export class TrainingTasks {
  private readonly done = new Set<TaskId>();
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly checks: Phaser.GameObjects.Graphics;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly unsub: Array<() => void> = [];
  private walkedForward = false;
  private walkedBack = false;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly match: Match,
    private readonly i18n: LocalizationManager,
  ) {
    const h = 70 + TASKS.length * ROW;
    const bg = scene.add.graphics().setDepth(DEPTH.hud);
    bg.fillStyle(COLORS.panel, 0.85);
    bg.fillRoundedRect(X - 20, Y0 - 48, 350, h, 10);
    bg.lineStyle(2, COLORS.cyan, 0.8);
    bg.strokeRoundedRect(X - 20, Y0 - 48, 350, h, 10);
    layer.add(bg);
    layer.add(
      scene.add
        .text(
          X,
          Y0 - 32,
          i18n.t('tutorial.tasks'),
          textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.cyan }),
        )
        .setDepth(DEPTH.hud),
    );
    this.checks = scene.add.graphics().setDepth(DEPTH.hud);
    layer.add(this.checks);
    TASKS.forEach((t, i) => {
      const row = scene.add
        .text(X + 32, Y0 + i * ROW, i18n.t(t.key), textStyle({ size: TYPE.small }))
        .setDepth(DEPTH.hud);
      layer.add(row);
      this.rows.push(row);
    });
    this.footer = scene.add
      .text(
        X - 4,
        Y0 + TASKS.length * ROW + 4,
        i18n.t('tutorial.energyInfinite'),
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim, wrap: 320 }),
      )
      .setDepth(DEPTH.hud);
    layer.add(this.footer);
    this.bind();
    this.render();
  }

  get completed(): number {
    return this.done.size;
  }

  get total(): number {
    return TASKS.length;
  }

  private bind(): void {
    const on = <K extends keyof MatchEvents>(k: K, fn: (p: MatchEvents[K]) => void): void => {
      this.unsub.push(this.match.events.on(k, fn));
    };
    on('jump', (e) => {
      if (e.fighter === 'p1') this.complete('jump');
    });
    on('dodge', (e) => {
      if (e.fighter === 'p1') this.complete('dodge');
    });
    on('block', (e) => {
      if (e.defender === 'p1') this.complete('block');
    });
    on('ultimateStart', (e) => {
      if (e.fighter === 'p1') this.complete('ultimate');
    });
    on('moveStart', (e) => {
      if (e.fighter === 'p1' && e.move.kind === 'special') this.complete('skill');
    });
    on('hit', (e) => {
      if (e.attacker !== 'p1') return;
      const slot = this.match.p1.moves.get(e.moveId)?.slot;
      if (slot === 'light' || slot === 'crouchLight' || slot === 'airLight') this.complete('light');
      if (slot === 'heavy' || slot === 'crouchHeavy' || slot === 'airHeavy') this.complete('heavy');
      if (e.combo >= 3) this.complete('combo');
    });
  }

  /** Polls continuous states (walking both ways, crouching). */
  update(): void {
    const p = this.match.p1;
    if (p.state === 'WALK' || p.state === 'RUN') {
      if (p.vx * p.facing > 0) this.walkedForward = true;
      if (p.vx * p.facing < 0) this.walkedBack = true;
      if (this.walkedForward && this.walkedBack) this.complete('move');
    }
    if (p.state === 'CROUCH') this.complete('crouch');
  }

  private complete(id: TaskId): void {
    if (this.done.has(id)) return;
    this.done.add(id);
    this.render();
    if (this.done.size === TASKS.length)
      this.footer.setText(this.i18n.t('tutorial.done')).setColor(TEXT_COLORS.success);
  }

  private render(): void {
    const g = this.checks;
    g.clear();
    TASKS.forEach((t, i) => {
      const y = Y0 + i * ROW + 12;
      const ok = this.done.has(t.id);
      g.lineStyle(2, ok ? COLORS.success : COLORS.lineHi, 1);
      g.strokeRect(X, y - 10, 20, 20);
      if (ok) {
        // Check mark shape + colour + dimmed text: more than one cue.
        g.lineStyle(4, COLORS.success, 1);
        g.lineBetween(X + 4, y, X + 9, y + 6);
        g.lineBetween(X + 9, y + 6, X + 18, y - 6);
      }
      this.rows[i].setColor(ok ? TEXT_COLORS.success : TEXT_COLORS.primary).setAlpha(ok ? 0.75 : 1);
    });
  }

  destroy(): void {
    for (const u of this.unsub) u();
  }
}
