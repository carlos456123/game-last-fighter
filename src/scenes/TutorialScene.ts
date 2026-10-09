import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { getFighter } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { keyLabel } from '@/input/ControlMapping';
import { getServices } from '@/systems/Services';
import type { ActionId } from '@/types';
import { Button } from '@/ui/Button';
import { drawIcon, type IconKind } from '@/ui/Icons';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { BattleData } from './SceneData';

interface Lesson {
  id: string;
  keys: ActionId[][];
  icon: IconKind;
  /** Demo animation sequence played by the rig. */
  demo: string[];
}

const LESSONS: Lesson[] = [
  { id: 'move', keys: [['left'], ['right']], icon: 'move', demo: ['walk', 'walk', 'run'] },
  { id: 'jump', keys: [['up']], icon: 'jump', demo: ['prejump', 'jump', 'fall'] },
  { id: 'crouch', keys: [['down']], icon: 'crouch', demo: ['crouch', 'crouch_block'] },
  { id: 'light', keys: [['light']], icon: 'light', demo: ['jab', 'cross', 'roundhouse'] },
  { id: 'heavy', keys: [['heavy']], icon: 'heavy', demo: ['heavy_punch'] },
  { id: 'block', keys: [['block']], icon: 'block', demo: ['block', 'crouch_block'] },
  {
    id: 'dodge',
    keys: [
      ['block', 'left'],
      ['block', 'right'],
    ],
    icon: 'dodge',
    demo: ['dodge'],
  },
  { id: 'skill', keys: [['skill']], icon: 'projectile', demo: ['cast_forward'] },
  { id: 'special', keys: [['special']], icon: 'antiAir', demo: ['uppercut'] },
  { id: 'ultimate', keys: [['ultimate']], icon: 'ultimate', demo: ['ultimate_rush', 'flurry', 'flurry'] },
];

const DEMO_STEP = 50;

/** "How to play": visual key caps, a live animated demo per action, and a practice mode. */
export class TutorialScene extends Phaser.Scene {
  private lesson = 0;
  private demo!: FighterRenderer;
  private clock = 0;
  private keyLayer!: Phaser.GameObjects.Container;
  private titleText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private pressedFlash = 0;
  private lessonButtons: Button[] = [];

  constructor() {
    super(SCENES.tutorial);
  }

  create(): void {
    const { i18n, keyboard } = getServices(this);
    const t = (k: string): string => i18n.t(k);
    createMenuBackground(this, COLORS.cyan);
    this.clock = 0;
    this.lesson = 0;
    this.add
      .text(
        GAME_WIDTH / 2,
        38,
        t('tutorial.title'),
        textStyle({ font: 'display', size: TYPE.h2, stroke: true }),
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        78,
        t('tutorial.subtitle'),
        textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
      )
      .setOrigin(0.5);

    this.lessonButtons = LESSONS.map(
      (l, i) =>
        new Button(this, 190, 128 + i * 52, {
          id: `lesson-${l.id}`,
          label: t(`tutorial.${l.id}`),
          width: 290,
          height: 44,
          fontSize: TYPE.small,
          variant: 'secondary',
          onClick: () => this.showLesson(i),
        }),
    );
    const practice = new Button(this, 1060, GAME_HEIGHT - 50, {
      id: 'tutorial-practice',
      label: t('tutorial.practice'),
      width: 300,
      onClick: () => this.practice(),
    });
    const back = new Button(this, 190, GAME_HEIGHT - 50, {
      id: 'tutorial-back',
      label: t('common.back'),
      width: 240,
      height: 48,
      variant: 'secondary',
      onClick: () => goTo(this, SCENES.menu),
    });

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.85);
    panel.fillRoundedRect(380, 110, 870, 520, 12);
    panel.lineStyle(2, COLORS.line, 1);
    panel.strokeRoundedRect(380, 110, 870, 520, 12);
    // Demo floor
    panel.lineStyle(3, COLORS.cyan, 0.6);
    panel.lineBetween(420, 560, 760, 560);

    this.demo = new FighterRenderer(this, getFighter('kael'), 1.25).setDepth(5);
    this.titleText = this.add.text(800, 150, '', textStyle({ font: 'display', size: TYPE.h2 }));
    this.descText = this.add.text(800, 400, '', textStyle({ size: TYPE.body, wrap: 420 }));
    this.keyLayer = this.add.container(800, 230);

    // Highlight the key cap when the player presses the real key: interactive, not just text.
    const unsub = keyboard.onKey((code) => {
      const lesson = LESSONS[this.lesson];
      if (lesson.keys.some((combo) => combo.some((a) => keyboard.matches(a, code)))) {
        this.pressedFlash = 12;
        getServices(this).audio.play('ui_hover');
      }
    });
    this.events.once('shutdown', unsub);

    const nav = new MenuNavigator(this, [...this.lessonButtons, practice, back], {
      onBack: () => goTo(this, SCENES.menu),
    });
    // Focusing a lesson shows it immediately.
    this.lessonButtons.forEach((b, i) => b.on('pointerover', () => this.showLesson(i)));
    const origFocus = nav.focus.bind(nav);
    nav.focus = (i: number) => {
      origFocus(i);
      if (i < LESSONS.length) this.showLesson(i);
    };
    this.showLesson(0);
    fadeIn(this);
  }

  private showLesson(i: number): void {
    if (i === this.lesson && this.titleText.text) return;
    const { i18n, settings } = getServices(this);
    this.lesson = i;
    this.clock = 0;
    const l = LESSONS[i];
    this.titleText.setText(i18n.t(`tutorial.${l.id}`));
    this.descText.setText(i18n.t(`tutorial.${l.id}Desc`));
    this.keyLayer.removeAll(true);
    let x = 0;
    l.keys.forEach((combo, ci) => {
      if (ci > 0) {
        this.keyLayer.add(
          this.add
            .text(x + 6, 32, '/', textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.dim }))
            .setOrigin(0, 0.5),
        );
        x += 34;
      }
      combo.forEach((action, ai) => {
        if (ai > 0) {
          this.keyLayer.add(
            this.add
              .text(x + 4, 32, '+', textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.dim }))
              .setOrigin(0, 0.5),
          );
          x += 30;
        }
        const raw = keyLabel(settings.controls[action][0] ?? '');
        const label = raw.startsWith('@') ? i18n.t(raw.slice(1)) : raw;
        const w = Math.max(64, label.length * 18 + 30);
        const cap = this.add.graphics();
        cap.fillStyle(0x000000, 0.6);
        cap.fillRoundedRect(x + 3, 6, w, 64, 8);
        cap.fillStyle(COLORS.panelHi, 1);
        cap.fillRoundedRect(x, 0, w, 60, 8);
        cap.lineStyle(3, COLORS.lineHi, 1);
        cap.strokeRoundedRect(x, 0, w, 60, 8);
        cap.setName('cap');
        this.keyLayer.add(cap);
        this.keyLayer.add(
          this.add.text(x + w / 2, 30, label, textStyle({ font: 'display', size: TYPE.h3 })).setOrigin(0.5),
        );
        x += w + 8;
      });
    });
    const icon = this.add.graphics();
    drawIcon(icon, l.icon, x + 50, 30, 44, COLORS.cyan);
    this.keyLayer.add(icon);
    this.lessonButtons.forEach((b, j) => b.setHint(j === i ? '▶' : ''));
  }

  private practice(): void {
    const data: BattleData = {
      mode: 'training',
      p1: 'kael',
      p2: 'bronn',
      arena: 'colosseum',
      shadow: false,
      stage: 0,
      totalStages: 1,
    };
    goTo(this, SCENES.battle, data);
  }

  override update(): void {
    this.clock++;
    const l = LESSONS[this.lesson];
    const step = Math.floor(this.clock / DEMO_STEP) % l.demo.length;
    const name = l.demo[step];
    const t = (this.clock % DEMO_STEP) / DEMO_STEP;
    const looping = name === 'walk' || name === 'run' || name === 'flurry' || name === 'crouch';
    // Jump demo rises and falls for real so the motion reads clearly.
    const jumpY = name === 'jump' ? t * 120 : name === 'fall' ? (1 - t) * 120 : 0;
    this.demo.drawAnimation(
      590,
      560 - jumpY,
      1,
      name,
      looping ? this.clock / 40 : t * 1.05,
      this.clock,
      name !== 'block',
    );
    if (this.pressedFlash > 0) this.pressedFlash--;
    this.keyLayer.list.forEach((o) => {
      if (o.name === 'cap')
        (o as Phaser.GameObjects.Graphics).setAlpha(
          this.pressedFlash > 0 ? 0.55 + (this.pressedFlash % 4) * 0.12 : 1,
        );
    });
    this.keyLayer.setScale(this.pressedFlash > 0 ? 1.04 : 1);
  }
}
