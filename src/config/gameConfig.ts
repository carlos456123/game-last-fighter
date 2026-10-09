import type { ControlBindings, Difficulty, Quality, Settings } from '@/types';

/**
 * Central configuration. Every tunable number that is not character/arena data lives here.
 */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const FPS = 60;
export const FRAME_SECONDS = 1 / FPS;
export const FRAME_MS = 1000 / FPS;
/** Maximum simulation steps per rendered frame, prevents a spiral of death after tab switches. */
export const MAX_STEPS_PER_FRAME = 4;

export const GRAVITY = 2600; // px/s²
export const DEFAULT_LANGUAGE = 'pt-BR';
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Debug tooling is only compiled into development builds. */
export const DEBUG_AVAILABLE = import.meta.env.DEV;
/** End-to-end test hook, only compiled in `--mode e2e` builds. */
export const E2E_HOOK = import.meta.env.VITE_E2E === 'true';

export const SAVE_KEY = 'last-fighter-save';
export const SAVE_VERSION = 1;

export const MATCH = {
  roundsToWin: 2,
  maxRounds: 5,
  roundTimeSeconds: 99,
  countdownStepFrames: 45,
  fightBannerFrames: 40,
  roundEndFrames: 150,
  koHitstop: 36,
} as const;

export const COMBAT = {
  energyMax: 100,
  energyRoundStart: 20,
  energyOnBlockAttacker: 0.5,
  energyOnBlockDefender: 3,
  energyPerDamageTaken: 0.45,
  energyPerfectDodge: 10,
  inputBufferFrames: 8,
  doubleTapFrames: 14,
  /** Each hit after the second in a combo multiplies damage by this factor. */
  comboDamageScale: 0.88,
  comboMinScale: 0.35,
  /** Each combo hit reduces hitstun by this fraction, which naturally ends long combos. */
  comboHitstunDecay: 0.06,
  comboMinHitstunScale: 0.45,
  maxJuggleHits: 3,
  knockdownFrames: 42,
  wakeupInvulnFrames: 14,
  stunFrames: 110,
  stunDecayPerFrame: 0.25,
  stunMashReduction: 3,
  landingLag: 4,
  prejumpFrames: 3,
  cancelWindowFrames: 12,
  flashFrames: 6,
  pushboxSeparation: 0.5,
  wallPushback: 0.7,
  blockPushbackScale: 0.6,
  perfectDodgeWindow: 6,
} as const;

export const CAMERA = {
  minZoom: 0.82,
  maxZoom: 1.0,
  /** Horizontal padding kept around both fighters (px). */
  padding: 260,
  lerp: 0.12,
  zoomLerp: 0.06,
  /** Vertical offset so the floor sits in the lower part of the screen. */
  verticalOffset: 40,
} as const;

export const SHAKE: Record<'light' | 'medium' | 'heavy', { duration: number; intensity: number }> = {
  light: { duration: 80, intensity: 0.003 },
  medium: { duration: 140, intensity: 0.006 },
  heavy: { duration: 260, intensity: 0.011 },
};

export const QUALITY_PRESETS: Record<
  Quality,
  { particleScale: number; ambientParticles: number; maxBurst: number; trails: boolean }
> = {
  low: { particleScale: 0.35, ambientParticles: 10, maxBurst: 8, trails: false },
  medium: { particleScale: 0.7, ambientParticles: 26, maxBurst: 16, trails: true },
  high: { particleScale: 1, ambientParticles: 48, maxBurst: 28, trails: true },
};

export const AUDIO = {
  defaultMusic: 0.6,
  defaultSfx: 0.8,
  defaultUi: 0.7,
  fadeSeconds: 0.8,
  lookaheadSeconds: 0.12,
  schedulerIntervalMs: 25,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: AUDIO.defaultMusic,
  sfxVolume: AUDIO.defaultSfx,
  uiVolume: AUDIO.defaultUi,
  muted: false,
  quality: 'high',
  particles: true,
  screenShake: true,
  reduceFlashes: false,
  language: DEFAULT_LANGUAGE,
  difficulty: DEFAULT_DIFFICULTY,
  touchControls: 'auto',
  touchOpacity: 0.55,
};

export const DEFAULT_CONTROLS: ControlBindings = {
  up: ['KeyW', 'ArrowUp'],
  left: ['KeyA', 'ArrowLeft'],
  down: ['KeyS', 'ArrowDown'],
  right: ['KeyD', 'ArrowRight'],
  light: ['KeyJ'],
  heavy: ['KeyK'],
  skill: ['KeyL'],
  special: ['KeyU'],
  ultimate: ['KeyI'],
  block: ['Space'],
  pause: ['Escape', 'KeyP'],
};

/** Keys that may never be bound because the browser or OS reserves them. */
export const RESERVED_KEYS = new Set(['F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'Tab']);

export const SCENES = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  menu: 'MenuScene',
  select: 'CharacterSelectScene',
  tutorial: 'TutorialScene',
  battle: 'BattleScene',
  pause: 'PauseScene',
  victory: 'VictoryScene',
  defeat: 'DefeatScene',
  settings: 'SettingsScene',
  credits: 'CreditsScene',
} as const;
export type SceneKey = (typeof SCENES)[keyof typeof SCENES];

export const TRANSITION_MS = 220;
