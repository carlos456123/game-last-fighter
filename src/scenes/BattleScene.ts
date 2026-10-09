import Phaser from 'phaser';
import { EnemyAI } from '@/ai/EnemyAI';
import { TrainingDummy } from '@/ai/TrainingDummy';
import { FighterRenderer } from '@/animation/FighterRenderer';
import { createShadowVariant, getFighter } from '@/characters/CharacterFactory';
import type { Side } from '@/characters/Character';
import {
  CAMERA,
  DEBUG_AVAILABLE,
  FPS,
  FRAME_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_STEPS_PER_FRAME,
  QUALITY_PRESETS,
  SCENES,
} from '@/config/gameConfig';
import { Match } from '@/core/Match';
import { getArena } from '@/data/arenas';
import { ArenaRenderer } from '@/render/ArenaRenderer';
import { VfxManager } from '@/render/VfxManager';
import { BattleAudio } from '@/systems/BattleAudio';
import { getServices, type Services } from '@/systems/Services';
import type { InputFrame } from '@/types';
import { createInputFrame } from '@/input/InputFrame';
import type { Reward } from '@/systems/ProgressionManager';
import { HUD } from '@/ui/HUD';
import { drawIcon, iconForMove } from '@/ui/Icons';
import { COLORS, DEPTH } from '@/ui/theme';
import { TrainingTasks } from '@/ui/TrainingTasks';
import { goTo, fadeIn } from '@/ui/Transitions';
import { VirtualControls } from '@/ui/VirtualControls';
import { registerTestTarget } from '@/ui/TestTargets';
import { DebugOverlay } from '@/utils/Debug';
import { clamp, lerp } from '@/utils/MathUtils';
import type { BattleData, ResultData } from './SceneData';

const END_DELAY_MS = 1800;

/** Public surface used by the pause menu and the e2e test hook. */
export interface BattleApi {
  match: Match;
  ai: EnemyAI | null;
  paused: () => boolean;
  data: BattleData;
}

/**
 * Runs a battle: feeds input into the pure Match at a fixed 60 Hz step and renders the result
 * (arena, fighters, effects, HUD, touch controls, camera). Contains no combat rules itself.
 */
export class BattleScene extends Phaser.Scene {
  private services!: Services;
  private data_!: BattleData;
  private match!: Match;
  private ai: EnemyAI | null = null;
  private dummy: TrainingDummy | null = null;
  private renderers!: Record<Side, FighterRenderer>;
  private arenaRenderer!: ArenaRenderer;
  private vfx!: VfxManager;
  private hud!: HUD;
  private audio!: BattleAudio;
  private tasks: TrainingTasks | null = null;
  private touch: VirtualControls | null = null;
  private debug: DebugOverlay | null = null;
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private accumulator = 0;
  private clock = 0;
  private zoom = 1;
  private camX = 0;
  private ending = false;
  private isPaused = false;
  private lastStepMs = 0;
  private readonly cleanups: Array<() => void> = [];
  private readonly idleInput = createInputFrame();

  constructor() {
    super(SCENES.battle);
  }

  init(data: BattleData): void {
    this.data_ = data;
    this.ending = false;
    this.isPaused = false;
    this.accumulator = 0;
    this.clock = 0;
    this.zoom = 1;
    this.tasks = null;
    this.touch = null;
    this.debug = null;
    this.ai = null;
    this.dummy = null;
    this.cleanups.length = 0;
  }

  create(): void {
    this.services = getServices(this);
    const { settings, i18n, audio, input, touch, keyboard } = this.services;
    const s = settings.settings;
    const arena = getArena(this.data_.arena);
    const p1 = getFighter(this.data_.p1);
    const base2 = getFighter(this.data_.p2);
    const p2 = this.data_.shadow ? createShadowVariant(base2) : base2;
    const training = this.data_.mode === 'training';
    this.match = new Match({ p1, p2, arena, mode: training ? 'training' : 'versus' });
    if (training) {
      this.match.infiniteEnergy = true;
      this.dummy = new TrainingDummy(this.match.p2, this.match.p1);
    } else {
      this.ai = new EnemyAI(this.match.p2, this.match.p1, p2.ai, s.difficulty, {
        projectiles: this.match.combat.projectiles,
        bounds: this.match.bounds,
      });
    }

    // Two layers rendered by two cameras: the world camera zooms/scrolls, the UI camera never does.
    this.world = this.add.layer();
    this.ui = this.add.layer();
    this.cameras.main.setBounds(0, 0, arena.width, GAME_HEIGHT).setBackgroundColor(COLORS.bg);
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.ignore(this.ui);
    this.uiCamera.ignore(this.world);

    this.arenaRenderer = new ArenaRenderer(this, arena, this.world, s.quality, s.particles);
    const r1 = new FighterRenderer(this, p1).setDepth(DEPTH.fighters + 1);
    const r2 = new FighterRenderer(this, p2).setDepth(DEPTH.fighters);
    for (const o of [...r1.objects, ...r2.objects]) this.world.add(o);
    this.renderers = { p1: r1, p2: r2 };

    this.vfx = new VfxManager(this, this.world, this.ui, this.match, this.renderers, s, i18n);
    const touchOn =
      s.touchControls === 'on' || (s.touchControls === 'auto' && this.sys.game.device.input.touch);
    this.hud = new HUD(this, this.ui, this.match, i18n, settings.controls, touchOn);
    this.audio = new BattleAudio(this.match, audio);
    if (touchOn) {
      this.touch = new VirtualControls(this, this.ui, touch, s.touchOpacity, () => this.match.p1);
      this.touch.setIcons({
        skill: iconForMove(this.match.p1.moveForSlot('skill')),
        special: iconForMove(this.match.p1.moveForSlot('special')),
      });
    }
    if (training) this.tasks = new TrainingTasks(this, this.ui, this.match, i18n);
    if (DEBUG_AVAILABLE) this.debug = new DebugOverlay(this, this.world, this.ui, this.match, this.ai);
    this.createPauseButton();

    input.reset();
    this.cleanups.push(
      keyboard.onKey((code) => {
        if (!this.scene.isActive()) return;
        if (keyboard.matches('pause', code)) this.openPause();
        if (code === 'F1' && this.debug) this.debug.toggle();
      }),
    );
    this.events.on('resume', this.onResume, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.scale.on('orientationchange', this.onOrientation, this);
    this.match.events.on('matchEnd', () => this.scheduleEnd());
    this.events.once('shutdown', () => this.cleanup());

    this.camX = (this.match.p1.x + this.match.p2.x) / 2;
    this.updateCamera(true);
    audio.playMusic(arena.music);
    this.registerApi();
    fadeIn(this);
  }

  private createPauseButton(): void {
    const g = this.add.graphics().setDepth(DEPTH.hud + 10);
    const x = GAME_WIDTH / 2;
    const y = 112;
    g.fillStyle(COLORS.panel, 0.85);
    g.fillCircle(x, y, 20);
    g.lineStyle(2, COLORS.lineHi, 1);
    g.strokeCircle(x, y, 20);
    drawIcon(g, 'pause', x, y, 22, COLORS.white);
    g.setInteractive(new Phaser.Geom.Circle(x, y, 26), Phaser.Geom.Circle.Contains);
    g.on('pointerup', () => this.openPause());
    this.ui.add(g);
    registerTestTarget(this, 'battle-pause', {
      x,
      y,
      visible: true,
      enabled: true,
      getBounds: () => new Phaser.Geom.Rectangle(x - 20, y - 20, 40, 40),
    });
  }

  private registerApi(): void {
    const api: BattleApi = { match: this.match, ai: this.ai, paused: () => this.isPaused, data: this.data_ };
    this.game.registry.set('battle-api', api);
  }

  // ---------------------------------------------------------------- loop

  override update(_time: number, delta: number): void {
    this.accumulator += Math.min(delta, 250);
    let steps = 0;
    const t0 = performance.now();
    while (this.accumulator >= FRAME_MS && steps < MAX_STEPS_PER_FRAME) {
      this.step();
      this.accumulator -= FRAME_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (steps > 0) this.lastStepMs = (performance.now() - t0) / steps;
    this.render(delta / 1000);
  }

  private step(): void {
    const p1: InputFrame = this.services.input.sample();
    const p2: InputFrame = this.ai ? this.ai.think() : this.dummy ? this.dummy.think() : this.idleInput;
    this.match.step(p1, p2);
    this.clock++;
  }

  private render(dt: number): void {
    const floor = this.match.arena.floorY;
    const s = this.services.settings.settings;
    const trails = QUALITY_PRESETS[s.quality].trails;
    this.renderers.p1.drawCharacter(this.match.p1, floor, this.clock, trails, s.reduceFlashes);
    this.renderers.p2.drawCharacter(this.match.p2, floor, this.clock, trails, s.reduceFlashes);
    // The fighter acting last is drawn on top.
    const p1Front = this.match.p1.move !== null || this.match.p2.state === 'HIT';
    this.renderers.p1.setDepth(DEPTH.fighters + (p1Front ? 2 : 0));
    this.renderers.p2.setDepth(DEPTH.fighters + (p1Front ? 0 : 2));
    this.vfx.update(this.match.combat.projectiles, this.clock);
    this.hud.update(dt);
    this.touch?.update();
    this.tasks?.update();
    this.updateCamera(false);
    this.debug?.update(this.lastStepMs);
  }

  /** Keeps both fighters visible: zooms out as they separate, clamps to the arena. */
  private updateCamera(instant: boolean): void {
    const a = this.match.p1;
    const b = this.match.p2;
    const span = Math.abs(a.x - b.x) + CAMERA.padding * 2;
    const targetZoom = clamp(GAME_WIDTH / span, CAMERA.minZoom, CAMERA.maxZoom);
    const mid = (a.x + b.x) / 2;
    this.zoom = instant ? targetZoom : lerp(this.zoom, targetZoom, CAMERA.zoomLerp);
    this.camX = instant ? mid : lerp(this.camX, mid, CAMERA.lerp);
    const cam = this.cameras.main;
    cam.setZoom(this.zoom);
    cam.centerOn(this.camX, GAME_HEIGHT / 2 - CAMERA.verticalOffset * (1 - this.zoom));
  }

  // ---------------------------------------------------------------- pause & lifecycle

  openPause(): void {
    if (this.isPaused || this.ending || this.match.isOver) return;
    this.isPaused = true;
    this.services.audio.pauseMusic();
    this.services.input.reset();
    this.scene.pause();
    this.scene.launch(SCENES.pause, { mode: this.data_.mode });
  }

  private onResume(): void {
    this.isPaused = false;
    this.accumulator = 0;
    this.services.input.reset();
    this.services.audio.resumeMusic();
  }

  private onBlur(): void {
    if (this.scene.isActive()) this.openPause();
  }

  private onOrientation(orientation: string): void {
    if (orientation === Phaser.Scale.PORTRAIT && this.scene.isActive()) this.openPause();
  }

  private scheduleEnd(): void {
    if (this.ending) return;
    this.ending = true;
    this.time.delayedCall(END_DELAY_MS, () => this.finish());
  }

  private finish(): void {
    const { progression, save, audio } = this.services;
    const winner = this.match.matchWinner;
    const won = winner === 'p1';
    const durationSeconds = Math.round(this.match.fightFrames / FPS);
    const stats = this.match.stats.p1;
    let reward: Reward | null = null;
    if (this.data_.mode === 'ladder') {
      save.update((d) => {
        reward = progression.recordResult(d, { won, fighterId: this.data_.p1, stats, durationSeconds });
      });
    }
    const result: ResultData = {
      battle: this.data_,
      won,
      draw: winner === null,
      stats,
      durationSeconds,
      reward,
    };
    audio.stopMusic();
    goTo(this, won ? SCENES.victory : SCENES.defeat, result);
  }

  private cleanup(): void {
    for (const c of this.cleanups) c();
    this.events.off('resume', this.onResume, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.scale.off('orientationchange', this.onOrientation, this);
    this.vfx.destroy();
    this.hud.destroy();
    this.audio.destroy();
    this.tasks?.destroy();
    this.touch?.destroy();
    this.arenaRenderer.destroy();
    this.renderers.p1.destroy();
    this.renderers.p2.destroy();
    this.match.events.clear();
    this.game.registry.remove('battle-api');
  }
}
