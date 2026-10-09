import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '@/config/gameConfig';
import { keyLabel } from '@/input/ControlMapping';
import { getServices } from '@/systems/Services';
import { ALL_ACTIONS } from '@/types';
import { Button } from '@/ui/Button';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, DEPTH, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { goTo } from '@/ui/Transitions';
import type { PauseData, SettingsData } from './SceneData';

/**
 * Pause overlay. The battle scene is really paused underneath (simulation, AI, tweens, timers,
 * particles and music), so resuming continues exactly where it stopped.
 */
export class PauseScene extends Phaser.Scene {
  private nav!: MenuNavigator;
  private controlsPanel: Phaser.GameObjects.Container | null = null;
  private confirmPanel: Phaser.GameObjects.Container | null = null;
  private buttons: Button[] = [];

  constructor() {
    super(SCENES.pause);
  }

  create(_data: PauseData): void {
    const { i18n } = getServices(this);
    const t = (k: string): string => i18n.t(k);
    this.controlsPanel = null;
    this.confirmPanel = null;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.72).setOrigin(0).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 260, 110, 520, 470, 14);
    panel.lineStyle(2, COLORS.accent, 1);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 260, 110, 520, 470, 14);
    this.add
      .text(GAME_WIDTH / 2, 170, t('pause.title'), textStyle({ font: 'display', size: TYPE.h1 }))
      .setOrigin(0.5);

    const mk = (
      id: string,
      label: string,
      y: number,
      fn: () => void,
      variant: 'primary' | 'danger' = 'primary',
    ): Button => new Button(this, GAME_WIDTH / 2, y, { id, label, onClick: fn, variant });
    this.buttons = [
      mk('pause-resume', t('pause.resume'), 270, () => this.resume()),
      mk('pause-controls', t('pause.controls'), 340, () => this.toggleControls()),
      mk('pause-settings', t('pause.settings'), 410, () => this.openSettings()),
      mk('pause-quit', t('pause.quit'), 480, () => this.askQuit(), 'danger'),
    ];
    this.nav = new MenuNavigator(this, this.buttons, { onBack: () => this.back() });
    this.events.on('resume', () => {
      this.nav.enabled = true;
    });
  }

  private back(): void {
    if (this.confirmPanel) {
      this.closeConfirm();
      return;
    }
    if (this.controlsPanel) {
      this.toggleControls();
      return;
    }
    this.resume();
  }

  private resume(): void {
    getServices(this).input.reset();
    this.scene.stop();
    this.scene.resume(SCENES.battle);
  }

  private openSettings(): void {
    this.nav.enabled = false;
    this.scene.pause();
    const data: SettingsData = { returnTo: SCENES.pause, overlay: true };
    this.scene.launch(SCENES.settings, data);
  }

  private toggleControls(): void {
    if (this.controlsPanel) {
      this.controlsPanel.destroy();
      this.controlsPanel = null;
      this.nav.setItems(this.buttons, true);
      return;
    }
    const { i18n, settings } = getServices(this);
    const c = this.add.container(0, 0).setDepth(DEPTH.modal);
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 0.97);
    g.fillRoundedRect(GAME_WIDTH / 2 - 330, 90, 660, 540, 12);
    g.lineStyle(2, COLORS.cyan, 1);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 330, 90, 660, 540, 12);
    c.add(g);
    c.add(
      this.add
        .text(GAME_WIDTH / 2, 124, i18n.t('pause.controls'), textStyle({ font: 'display', size: TYPE.h3 }))
        .setOrigin(0.5),
    );
    ALL_ACTIONS.forEach((a, i) => {
      const y = 170 + i * 36;
      const keys = settings.controls[a].map((code) => {
        const l = keyLabel(code);
        return l.startsWith('@') ? i18n.t(l.slice(1)) : l;
      });
      c.add(this.add.text(GAME_WIDTH / 2 - 290, y, i18n.t(`actions.${a}`), textStyle({ size: TYPE.small })));
      c.add(
        this.add
          .text(
            GAME_WIDTH / 2 + 290,
            y,
            keys.join(' / '),
            textStyle({ font: 'display', size: TYPE.small, color: TEXT_COLORS.gold }),
          )
          .setOrigin(1, 0),
      );
    });
    const close = new Button(this, GAME_WIDTH / 2, 590, {
      id: 'pause-controls-close',
      label: i18n.t('common.back'),
      width: 240,
      height: 46,
      onClick: () => this.toggleControls(),
    });
    c.add(close);
    this.controlsPanel = c;
    this.nav.setItems([close]);
  }

  private askQuit(): void {
    const { i18n } = getServices(this);
    const c = this.add.container(0, 0).setDepth(DEPTH.modal);
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 0.97);
    g.fillRoundedRect(GAME_WIDTH / 2 - 300, 230, 600, 260, 12);
    g.lineStyle(2, COLORS.danger, 1);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 300, 230, 600, 260, 12);
    c.add(g);
    c.add(
      this.add
        .text(
          GAME_WIDTH / 2,
          300,
          i18n.t('pause.confirmQuit'),
          textStyle({ size: TYPE.body, align: 'center', wrap: 520 }),
        )
        .setOrigin(0.5),
    );
    const yes = new Button(this, GAME_WIDTH / 2 - 130, 420, {
      id: 'pause-quit-yes',
      label: i18n.t('common.yes'),
      width: 220,
      height: 50,
      variant: 'danger',
      onClick: () => this.quit(),
    });
    const no = new Button(this, GAME_WIDTH / 2 + 130, 420, {
      id: 'pause-quit-no',
      label: i18n.t('common.no'),
      width: 220,
      height: 50,
      onClick: () => this.closeConfirm(),
    });
    c.add([yes, no]);
    this.confirmPanel = c;
    this.nav.setItems([no, yes]);
  }

  private closeConfirm(): void {
    this.confirmPanel?.destroy();
    this.confirmPanel = null;
    this.nav.setItems(this.buttons, true);
  }

  private quit(): void {
    const { audio } = getServices(this);
    audio.stopMusic();
    this.scene.stop(SCENES.battle);
    goTo(this, SCENES.menu);
  }
}
