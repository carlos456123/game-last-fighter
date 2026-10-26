import Phaser from 'phaser';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { getFighter, hasFighter, shadowPalette } from '@/characters/CharacterFactory';
import { GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from '@/config/gameConfig';
import { getServices } from '@/systems/Services';
import { Button } from '@/ui/Button';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { fadeIn, goTo } from '@/ui/Transitions';
import type { DialogData } from './SceneData';

const TYPE_SPEED = 2; // characters per frame

/**
 * Short story scenes: a speaker, a line of text, and the speaker's fighter rendered live.
 * Always skippable; advancing is click/tap, Enter, Space or the light attack key.
 */
export class DialogScene extends Phaser.Scene {
  private data_!: DialogData;
  private index = 0;
  private shown = 0;
  private full = '';
  private text!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private portrait: FighterRenderer | null = null;
  private portraitSide: 1 | -1 = 1;
  private clock = 0;
  private done = false;

  constructor() {
    super(SCENES.dialog);
  }

  init(data: DialogData): void {
    this.data_ = data;
    this.index = 0;
    this.shown = 0;
    this.clock = 0;
    this.done = false;
    this.portrait = null;
  }

  create(): void {
    const { i18n } = getServices(this);
    createMenuBackground(this, COLORS.accent);
    if (this.data_.titleKey) {
      this.add
        .text(
          GAME_WIDTH / 2,
          60,
          i18n.t(this.data_.titleKey),
          textStyle({ font: 'display', size: TYPE.h2, color: TEXT_COLORS.gold, stroke: true }),
        )
        .setOrigin(0.5);
    }
    const box = this.add.graphics().setDepth(10);
    box.fillStyle(COLORS.panel, 0.95);
    box.fillRoundedRect(80, GAME_HEIGHT - 250, GAME_WIDTH - 160, 170, 12);
    box.lineStyle(2, COLORS.accent, 1);
    box.strokeRoundedRect(80, GAME_HEIGHT - 250, GAME_WIDTH - 160, 170, 12);
    this.speakerText = this.add
      .text(
        110,
        GAME_HEIGHT - 236,
        '',
        textStyle({ font: 'display', size: TYPE.h3, color: TEXT_COLORS.accent }),
      )
      .setDepth(11);
    this.text = this.add
      .text(110, GAME_HEIGHT - 196, '', textStyle({ size: TYPE.body, wrap: GAME_WIDTH - 230 }))
      .setDepth(11);
    this.add
      .text(
        GAME_WIDTH - 100,
        GAME_HEIGHT - 96,
        i18n.t('dialog.advance'),
        textStyle({ size: TYPE.tiny, color: TEXT_COLORS.dim }),
      )
      .setOrigin(1, 1)
      .setDepth(11);
    const skip = new Button(this, GAME_WIDTH - 130, 50, {
      id: 'dialog-skip',
      label: i18n.t('dialog.skip'),
      width: 200,
      height: 44,
      fontSize: TYPE.small,
      variant: 'secondary',
      onClick: () => this.finish(),
    });
    skip.setDepth(12);
    // Clicking anywhere (outside the skip button) advances.
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.includes(skip)) this.advance();
    });
    new MenuNavigator(
      this,
      [{ enabled: true, visible: true, setFocused: () => undefined, activate: () => this.advance() }],
      {
        onBack: () => this.finish(),
      },
    );
    this.showLine();
    fadeIn(this);
  }

  private speakerName(id: string): string {
    const { i18n } = getServices(this);
    if (id === 'council') return i18n.t('story.council');
    if (id === 'narrator') return '';
    if (id === 'shadow') return i18n.t('fighters.shadow.name');
    return hasFighter(id) ? i18n.t(getFighter(id).nameKey) : id;
  }

  private showLine(): void {
    const { i18n } = getServices(this);
    const line = this.data_.lines[this.index];
    this.full = i18n.t(line.textKey, line.params);
    this.shown = 0;
    this.speakerText.setText(this.speakerName(line.speaker));
    this.portrait?.destroy();
    this.portrait = null;
    const id = line.speaker === 'shadow' ? (line.params?.fighter as string | undefined) : line.speaker;
    if (id && hasFighter(id)) {
      this.portrait = new FighterRenderer(this, getFighter(id), 1.5).setDepth(5);
      if (line.speaker === 'shadow') this.portrait.setPalette(shadowPalette(getFighter(id).palette));
      this.portraitSide = this.index % 2 === 0 ? 1 : -1;
    }
  }

  private advance(): void {
    if (this.done) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      return;
    }
    getServices(this).audio.play('ui_click');
    this.index++;
    if (this.index >= this.data_.lines.length) this.finish();
    else this.showLine();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    goTo(this, this.data_.next as SceneKey, this.data_.nextData);
  }

  override update(): void {
    this.clock++;
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + TYPE_SPEED);
      this.text.setText(this.full.slice(0, Math.floor(this.shown)));
    }
    const x = this.portraitSide === 1 ? 300 : GAME_WIDTH - 300;
    this.portrait?.drawAnimation(
      x,
      GAME_HEIGHT - 250,
      this.portraitSide === 1 ? 1 : -1,
      'idle',
      this.clock / 64,
      this.clock,
    );
  }
}
