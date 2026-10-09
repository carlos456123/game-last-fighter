import Phaser from 'phaser';
import { DEFAULT_CONTROLS, GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from '@/config/gameConfig';
import { keyLabel, rebind } from '@/input/ControlMapping';
import { getServices } from '@/systems/Services';
import { ALL_ACTIONS, type ActionId, type Difficulty, type Quality, type TouchMode } from '@/types';
import { Button, type Focusable } from '@/ui/Button';
import { createMenuBackground } from '@/ui/MenuBackground';
import { MenuNavigator } from '@/ui/MenuNavigator';
import { COLORS, TEXT_COLORS, TYPE, textStyle } from '@/ui/theme';
import { showToast } from '@/ui/Toast';
import { fadeIn, goTo } from '@/ui/Transitions';
import { KeyBindRow, Selector, Slider } from '@/ui/Widgets';
import type { SettingsData } from './SceneData';

type TabId = 'audio' | 'video' | 'gameplay' | 'controls' | 'language';
const TABS: TabId[] = ['audio', 'video', 'gameplay', 'controls', 'language'];
const ROW_X = GAME_WIDTH / 2;

/** Settings with real effects: every option is persisted and applied immediately. */
export class SettingsScene extends Phaser.Scene {
  private data_!: SettingsData;
  private tab = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Button[] = [];
  private nav!: MenuNavigator;
  private back!: Button;
  private listeningRow: KeyBindRow | null = null;
  private listeningAction: ActionId | null = null;
  /** Ignores the very key press that started listening. */
  private armed = false;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super(SCENES.settings);
  }

  init(data: SettingsData): void {
    this.data_ = {
      returnTo: data?.returnTo ?? SCENES.menu,
      overlay: data?.overlay ?? false,
      tab: data?.tab ?? 0,
    };
    this.tab = this.data_.tab ?? 0;
    this.content = [];
    this.tabButtons = [];
    this.listeningRow = null;
  }

  create(): void {
    const { i18n, keyboard } = getServices(this);
    const t = (k: string): string => i18n.t(k);
    if (this.data_.overlay)
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.94).setOrigin(0).setInteractive();
    else createMenuBackground(this, COLORS.cyan);
    this.add
      .text(
        GAME_WIDTH / 2,
        40,
        t('settings.title'),
        textStyle({ font: 'display', size: TYPE.h2, stroke: true }),
      )
      .setOrigin(0.5);
    this.tabButtons = TABS.map(
      (id, i) =>
        new Button(this, GAME_WIDTH / 2 + (i - 2) * 214, 104, {
          id: `settings-tab-${id}`,
          label: t(`settings.${id}`),
          width: 200,
          height: 46,
          fontSize: TYPE.small,
          variant: 'secondary',
          onClick: () => this.showTab(i),
        }),
    );
    this.back = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, {
      id: 'settings-back',
      label: t('common.back'),
      width: 260,
      height: 48,
      onClick: () => this.close(),
    });
    this.nav = new MenuNavigator(this, [], { onBack: () => this.close() });
    this.unsubscribe = keyboard.onKey((code, e) => this.onRawKey(code, e));
    this.events.once('shutdown', () => this.unsubscribe?.());
    this.showTab(this.tab);
    if (!this.data_.overlay) fadeIn(this);
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

  private showTab(index: number): void {
    this.tab = index;
    for (const o of this.content) o.destroy();
    this.content = [];
    this.tabButtons.forEach((b, i) => {
      b.setSelected(i === index);
      b.setFocused(false);
    });
    const rows = this.buildTab(TABS[index]);
    this.nav.setItems([this.tabRow(), ...rows, this.back]);
    this.nav.focus(0);
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.content.push(o);
    return o;
  }

  private buildTab(tab: TabId): Focusable[] {
    const { i18n, settings, audio } = getServices(this);
    const t = (k: string): string => i18n.t(k);
    const s = settings.settings;
    const onOff = (): Array<{ value: boolean; label: string }> => [
      { value: true, label: t('common.on') },
      { value: false, label: t('common.off') },
    ];
    const y = (i: number): number => 180 + i * 62;
    const rows: Focusable[] = [];
    const add = <T extends Focusable & Phaser.GameObjects.GameObject>(w: T): T => {
      this.track(w);
      rows.push(w);
      return w;
    };
    switch (tab) {
      case 'audio':
        add(
          new Slider(this, ROW_X, y(0), t('settings.music'), 'set-music', s.musicVolume, (v) =>
            settings.set('musicVolume', v),
          ),
        );
        add(
          new Slider(this, ROW_X, y(1), t('settings.sfx'), 'set-sfx', s.sfxVolume, (v) => {
            settings.set('sfxVolume', v);
            audio.play('hit_light');
          }),
        );
        add(
          new Slider(this, ROW_X, y(2), t('settings.ui'), 'set-ui', s.uiVolume, (v) =>
            settings.set('uiVolume', v),
          ),
        );
        add(
          new Selector(this, ROW_X, y(3), t('settings.mute'), 'set-mute', onOff(), s.muted ? 0 : 1, (v) =>
            settings.set('muted', v),
          ),
        );
        break;
      case 'video': {
        const q: Array<{ value: Quality; label: string }> = [
          { value: 'low', label: t('settings.qualityLow') },
          { value: 'medium', label: t('settings.qualityMedium') },
          { value: 'high', label: t('settings.qualityHigh') },
        ];
        add(
          new Selector(
            this,
            ROW_X,
            y(0),
            t('settings.quality'),
            'set-quality',
            q,
            q.findIndex((o) => o.value === s.quality),
            (v) => settings.set('quality', v),
          ),
        );
        add(
          new Selector(
            this,
            ROW_X,
            y(1),
            t('settings.particles'),
            'set-particles',
            onOff(),
            s.particles ? 0 : 1,
            (v) => settings.set('particles', v),
          ),
        );
        add(
          new Selector(
            this,
            ROW_X,
            y(2),
            t('settings.shake'),
            'set-shake',
            onOff(),
            s.screenShake ? 0 : 1,
            (v) => settings.set('screenShake', v),
          ),
        );
        add(
          new Selector(
            this,
            ROW_X,
            y(3),
            t('settings.flashes'),
            'set-flashes',
            onOff(),
            s.reduceFlashes ? 0 : 1,
            (v) => settings.set('reduceFlashes', v),
          ),
        );
        break;
      }
      case 'gameplay': {
        const d: Array<{ value: Difficulty; label: string }> = (
          ['easy', 'normal', 'hard'] as Difficulty[]
        ).map((v) => ({ value: v, label: t(`difficulty.${v}`) }));
        add(
          new Selector(
            this,
            ROW_X,
            y(0),
            t('settings.difficulty'),
            'set-difficulty',
            d,
            d.findIndex((o) => o.value === s.difficulty),
            (v) => settings.set('difficulty', v),
          ),
        );
        const tm: Array<{ value: TouchMode; label: string }> = [
          { value: 'auto', label: t('settings.touchAuto') },
          { value: 'on', label: t('settings.touchOn') },
          { value: 'off', label: t('settings.touchOff') },
        ];
        add(
          new Selector(
            this,
            ROW_X,
            y(1),
            t('settings.touch'),
            'set-touch',
            tm,
            tm.findIndex((o) => o.value === s.touchControls),
            (v) => settings.set('touchControls', v),
          ),
        );
        add(
          new Slider(
            this,
            ROW_X,
            y(2),
            t('settings.touchOpacity'),
            'set-touch-opacity',
            s.touchOpacity,
            (v) => settings.set('touchOpacity', Math.max(0.2, v)),
          ),
        );
        break;
      }
      case 'controls': {
        ALL_ACTIONS.forEach((action, i) => {
          const row = new KeyBindRow(
            this,
            ROW_X,
            168 + i * 44,
            t(`actions.${action}`),
            `set-key-${action}`,
            this.keyText(settings.controls[action]),
            (r) => this.listen(r, action),
          );
          add(row);
        });
        const reset = this.track(
          new Button(this, ROW_X + 270, GAME_HEIGHT - 40, {
            id: 'settings-reset-controls',
            label: t('settings.resetControls'),
            width: 280,
            height: 44,
            fontSize: TYPE.small,
            variant: 'danger',
            onClick: () => {
              settings.setControls(structuredClone(DEFAULT_CONTROLS));
              this.showTab(this.tab);
              showToast(this, t('settings.saved'), COLORS.success);
            },
          }),
        );
        rows.push(reset);
        break;
      }
      case 'language': {
        const langs = i18n.available.map((l) => ({ value: l, label: t('settings.languageName') }));
        add(
          new Selector(this, ROW_X, y(0), t('settings.language'), 'set-language', langs, 0, (v) =>
            settings.set('language', v),
          ),
        );
        this.track(
          this.add
            .text(
              ROW_X,
              y(1),
              t('settings.languageOnly'),
              textStyle({ size: TYPE.small, color: TEXT_COLORS.dim }),
            )
            .setOrigin(0.5),
        );
        break;
      }
      default:
        break;
    }
    if (tab !== 'controls') {
      this.track(
        this.add
          .text(
            ROW_X,
            GAME_HEIGHT - 92,
            t('settings.hint'),
            textStyle({ size: TYPE.tiny, color: TEXT_COLORS.muted }),
          )
          .setOrigin(0.5),
      );
    }
    return rows;
  }

  private keyText(codes: readonly string[]): string {
    const { i18n } = getServices(this);
    return codes
      .map((c) => {
        const l = keyLabel(c);
        return l.startsWith('@') ? i18n.t(l.slice(1)) : l;
      })
      .join(' / ');
  }

  private listen(row: KeyBindRow, action: ActionId): void {
    const { i18n } = getServices(this);
    this.listeningRow = row;
    this.listeningAction = action;
    this.nav.enabled = false;
    this.armed = false;
    this.time.delayedCall(60, () => {
      this.armed = true;
    });
    row.setListening(true, '...');
    showToast(this, i18n.t('settings.pressKey', { action: i18n.t(`actions.${action}`) }), COLORS.gold, 2200);
  }

  private onRawKey(code: string, e: KeyboardEvent): void {
    if (!this.listeningRow || !this.listeningAction || !this.armed || !this.scene.isActive()) return;
    e.preventDefault();
    const { settings, i18n, audio } = getServices(this);
    const row = this.listeningRow;
    const action = this.listeningAction;
    this.listeningRow = null;
    this.listeningAction = null;
    // Re-enable navigation after this key event has been handled by everyone.
    this.time.delayedCall(0, () => {
      this.nav.enabled = true;
    });
    if (code === 'Escape') {
      row.setListening(false, '');
      row.setKey(this.keyText(settings.controls[action]));
      audio.play('ui_back');
      return;
    }
    const result = rebind(settings.controls, action, code);
    if (result.rejected) {
      audio.play('ui_error');
      showToast(this, i18n.t('settings.reserved'), COLORS.danger);
      row.setListening(false, '');
      row.setKey(this.keyText(settings.controls[action]));
      return;
    }
    settings.setControls(result.bindings);
    audio.play('ui_click');
    if (result.swappedWith) {
      showToast(
        this,
        i18n.t('settings.swapped', { action: i18n.t(`actions.${result.swappedWith}`) }),
        COLORS.gold,
      );
    }
    const focused = this.nav.focusedIndex;
    this.showTab(this.tab);
    this.nav.focus(focused);
  }

  private close(): void {
    if (this.listeningRow) return;
    getServices(this).audio.play('ui_back');
    if (this.data_.overlay) {
      this.scene.stop();
      this.scene.resume(this.data_.returnTo as SceneKey);
    } else {
      goTo(this, this.data_.returnTo as SceneKey);
    }
  }
}
