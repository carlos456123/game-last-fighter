/**
 * Shared type definitions for LAST FIGHTER.
 *
 * Conventions used by the simulation (pure logic, no Phaser):
 * - Time is measured in frames at a fixed 60 Hz tick.
 * - Speeds in data are px/second; the simulation converts them per frame.
 * - Simulation Y is the height above the floor (up is positive). Renderers convert to screen space.
 * - Box offsets are authored for a fighter facing right; they are mirrored when facing left.
 */

export type Facing = 1 | -1;

/** Logical buttons the fighters understand. `pause` is handled by scenes, never by fighters. */
export const FIGHT_BUTTONS = [
  'left',
  'right',
  'up',
  'down',
  'light',
  'heavy',
  'skill',
  'special',
  'ultimate',
  'block',
] as const;
export type FightButton = (typeof FIGHT_BUTTONS)[number];
export type ActionId = FightButton | 'pause';
export const ALL_ACTIONS: readonly ActionId[] = [...FIGHT_BUTTONS, 'pause'];

export type ButtonState = Record<FightButton, boolean>;

/** One tick of input for one fighter: what is held and what was pressed this tick. */
export interface InputFrame {
  held: ButtonState;
  pressed: ButtonState;
}

export interface Rect {
  /** Left edge (world) */
  x: number;
  /** Bottom edge, height above the floor */
  y: number;
  w: number;
  h: number;
}

/** Box relative to the fighter origin (feet centre) authored facing right. */
export type BoxData = Rect;

export interface FrameRange {
  from: number;
  to: number;
}

export type HitLevel = 'high' | 'mid' | 'low' | 'overhead';
export type ShakeLevel = 'none' | 'light' | 'medium' | 'heavy';

export type VfxId =
  | 'spark_light'
  | 'spark_heavy'
  | 'fire'
  | 'quake'
  | 'shadow'
  | 'kunai'
  | 'ultimate_burst'
  | 'wind'
  | 'holy'
  | 'chi'
  | 'plasma'
  | 'arcane'
  | 'blood_fire';

export type SfxId =
  | 'hit_light'
  | 'hit_heavy'
  | 'block'
  | 'whiff'
  | 'dodge'
  | 'perfect_dodge'
  | 'jump'
  | 'land'
  | 'fireball'
  | 'uppercut'
  | 'shockwave'
  | 'charge'
  | 'kunai'
  | 'teleport'
  | 'ultimate_start'
  | 'ultimate_hit'
  | 'ko'
  | 'countdown'
  | 'fight'
  | 'victory'
  | 'defeat'
  | 'stun'
  | 'energy_full'
  | 'ui_hover'
  | 'ui_click'
  | 'ui_back'
  | 'ui_error'
  | 'unlock'
  | 'counter'
  | 'javelin'
  | 'plasma'
  | 'orb'
  | 'beam'
  | 'rush'
  | 'pact'
  | 'iai'
  | 'booster'
  | 'achievement';

/** Properties applied when an attack (melee or projectile) connects. */
export interface HitProperties {
  damage: number;
  /** Fraction of damage dealt through a block (0..1). */
  chip: number;
  /** Points added to the defender's stun (dizzy) meter. */
  stun: number;
  hitstun: number;
  blockstun: number;
  /** Horizontal push in px/s applied to the defender. */
  knockback: number;
  /** Vertical launch in px/s. 0 keeps the defender grounded. */
  launch: number;
  knockdown: boolean;
  level: HitLevel;
  hitstop: number;
  shake: ShakeLevel;
  energyGain: number;
  vfx: VfxId;
  sfx: SfxId;
}

export type MoveSlot =
  | 'light'
  | 'heavy'
  | 'crouchLight'
  | 'crouchHeavy'
  | 'airLight'
  | 'airHeavy'
  | 'skill'
  | 'special'
  | 'ultimate';

export type MoveKind = 'normal' | 'special' | 'ultimate';
export type MoveContext = 'ground' | 'air';

export interface MoveMovement {
  phase: 'startup' | 'active' | 'all';
  /** Forward speed px/s (relative to facing). */
  vx: number;
  /** Optional vertical impulse px/s applied once at the start of the phase. */
  vy?: number;
}

export interface ProjectileData {
  visual: 'fireball' | 'shockwave' | 'kunai' | 'javelin' | 'plasma' | 'orb' | 'lightLance';
  speed: number;
  lifetime: number;
  hitbox: BoxData;
  /** Spawn offset relative to the fighter origin (facing right). */
  spawn: { x: number; y: number };
  /** Number of projectiles spawned (fanned vertically). */
  count: number;
  /** Vertical speed difference between fanned projectiles in px/s. */
  spread: number;
  /** Ground waves hug the floor and can be jumped over. */
  grounded: boolean;
  hit: HitProperties;
  /** Zone projectiles stay alive after hitting, up to `hits` times with `interval` frames between hits. */
  persistent?: { hits: number; interval: number };
}

/** A frame range of a move during which the fighter moves at a given speed (multi-step dashes). */
export interface MovementSegment {
  from: number;
  to: number;
  /** Forward speed px/s (relative to facing). */
  vx: number;
  /** Optional vertical impulse applied on the first frame of the segment. */
  vy?: number;
}

/**
 * Counter stance: if the fighter is attacked during the window, the attack is absorbed and the
 * attacker is struck with `hit` (and the move's lock sequence, if any, starts).
 */
export interface CounterData {
  from: number;
  to: number;
  hit: HitProperties;
}

export interface TeleportData {
  /** Frame (from move start) at which the teleport happens. */
  atFrame: number;
  /** Distance behind the opponent where the fighter reappears. */
  behindOffset: number;
}

/** Scripted multi-hit sequence triggered when the first hit of a move connects (ultimates). */
export interface LockSequence {
  hits: number;
  interval: number;
  hit: HitProperties;
  final: HitProperties;
}

export interface MoveData {
  id: string;
  slot: MoveSlot;
  kind: MoveKind;
  context: MoveContext;
  nameKey: string;
  descKey: string;
  animation: string;
  startup: number;
  active: number;
  recovery: number;
  /** Melee hitbox. Moves without one (pure projectiles) leave it undefined. */
  hitbox?: BoxData;
  /** Multi-hit melee: number of hits spread over the active window. */
  hits: number;
  hit: HitProperties;
  energyCost: number;
  cooldown: number;
  movement?: MoveMovement;
  projectile?: ProjectileData;
  teleport?: TeleportData;
  invulnerable?: FrameRange;
  armor?: FrameRange & { hits: number };
  /** Next move id when light is pressed again after contact. */
  chain?: string;
  /** Slots this move can be cancelled into after it makes contact. */
  cancels: MoveSlot[];
  /** Ultimate "super freeze" length in frames. */
  cinematicFreeze?: number;
  lock?: LockSequence;
  /** Only hits targets standing on the floor (quakes). */
  groundedTargetsOnly?: boolean;
  /** Extra recovery frames applied when an air move lands. */
  landingLag?: number;
  /** Sound played when the move starts (swing sound is used when omitted). */
  startSfx?: SfxId;
  /** Multi-step movement (overrides `movement` while a segment is active). */
  path?: MovementSegment[];
  counter?: CounterData;
  /** Health paid to use the move. Can never knock out the user. */
  healthCost?: number;
}

export type Archetype =
  | 'balanced'
  | 'tank'
  | 'speed'
  | 'assassin'
  | 'zoner'
  | 'technical'
  | 'control'
  | 'combo'
  | 'brute'
  | 'defense';

export interface FighterStats {
  health: number;
  walkSpeed: number;
  backSpeed: number;
  runSpeed: number;
  jumpVelocity: number;
  airSpeed: number;
  /** Extra mid-air jumps. */
  airJumps: number;
  /** Damage dealt multiplier. */
  strength: number;
  /** Damage taken divisor. Higher is tougher. */
  defense: number;
  /** Knockback taken divisor. */
  weight: number;
  stunThreshold: number;
}

export interface DodgeData {
  duration: number;
  invulnerable: FrameRange;
  distance: number;
  cooldown: number;
}

export type BodyFeature =
  | 'headband'
  | 'hairSpikes'
  | 'scarf'
  | 'hood'
  | 'shoulderPads'
  | 'gauntlets'
  | 'twinBlades'
  | 'wraps'
  | 'beard'
  | 'belt'
  | 'mask'
  | 'ponytail'
  | 'katana'
  | 'wingedHelmet'
  | 'cape'
  | 'spear'
  | 'topknot'
  | 'longBeard'
  | 'robotHead'
  | 'antenna'
  | 'armCannon'
  | 'longHair'
  | 'staff'
  | 'mohawk'
  | 'spikedPad';

export interface BodyData {
  /** Total standing height in px. */
  height: number;
  /** Hurtbox width in px. */
  width: number;
  /** Proportions relative to height. */
  legRatio: number;
  armRatio: number;
  torsoRatio: number;
  headRatio: number;
  shoulderWidth: number;
  hipWidth: number;
  limbThickness: number;
  features: BodyFeature[];
  /** Pose styling: how wide the stance is and how high the guard sits. */
  stanceWidth: number;
  guardHeight: number;
  lean: number;
  /** Victory pose variant (animation `victory_<name>`). */
  victory: 'fist' | 'flex' | 'blades' | 'bow' | 'cast';
}

export interface Palette {
  primary: number;
  secondary: number;
  accent: number;
  skin: number;
  hair: number;
  outline: number;
  energy: number;
}

export interface BehaviorProfile {
  aggression: number;
  defense: number;
  mobility: number;
  comboPreference: number;
  skillUsage: number;
  dodgePreference: number;
  retreatPreference: number;
  /** Preferred engagement distance in px. */
  preferredRange: number;
}

/**
 * How a fighter is unlocked. Every rule is checked by the progression system from recorded
 * match results; the UI only displays it. `wins` counts valid Arcade wins (kept for save compatibility).
 */
export type UnlockRule =
  | { type: 'default' }
  | { type: 'wins'; count: number }
  | { type: 'perfectDodges'; count: number }
  | { type: 'flawlessWins'; count: number }
  | { type: 'playerLevel'; level: number }
  | { type: 'arcadeStreak'; count: number }
  | { type: 'defeatShadow' }
  | { type: 'tournamentWin' };

export interface FighterData {
  id: string;
  nameKey: string;
  titleKey: string;
  bioKey: string;
  personalityKey: string;
  originKey: string;
  styleKey: string;
  weaknessKey: string;
  archetype: Archetype;
  mainAttribute: RatingKey;
  stats: FighterStats;
  dodge: DodgeData;
  body: BodyData;
  palette: Palette;
  moves: MoveData[];
  slots: Record<MoveSlot, string>;
  ai: BehaviorProfile;
  unlock: UnlockRule;
}

export type RatingKey = 'power' | 'defense' | 'speed' | 'range' | 'mobility' | 'technique';
export type Ratings = Record<RatingKey, number>;

export type ArenaLayer =
  | { type: 'sky'; top: number; bottom: number }
  | { type: 'sun'; x: number; y: number; radius: number; color: number; glow: number }
  | {
      type: 'silhouette';
      shape: 'arches' | 'towers' | 'mountains' | 'pillars' | 'skyline' | 'industrial' | 'temple';
      color: number;
      baseY: number;
      height: number;
      seed: number;
      scroll: number;
      alpha: number;
    }
  | { type: 'floor'; color: number; lineColor: number; edgeColor: number; pattern: 'stone' | 'metal' }
  | {
      type: 'props';
      kind: 'torches' | 'lamps' | 'signs' | 'braziers';
      color: number;
      spacing: number;
      scroll: number;
    };

export interface ArenaData {
  id: string;
  nameKey: string;
  descKey: string;
  width: number;
  /** Screen-space Y of the floor line. */
  floorY: number;
  bounds: { left: number; right: number };
  spawn: { p1: number; p2: number };
  music: MusicId;
  ambient: 'embers' | 'rain' | 'dust' | 'ash';
  ambientColor: number;
  layers: ArenaLayer[];
}

export type MusicId =
  'menu' | 'battle_colosseum' | 'battle_neon' | 'battle_district' | 'battle_sanctuary' | 'boss' | 'victory';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Quality = 'low' | 'medium' | 'high';
export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  uiVolume: number;
  muted: boolean;
  quality: Quality;
  particles: boolean;
  screenShake: boolean;
  reduceFlashes: boolean;
  language: string;
  difficulty: Difficulty;
  touchControls: TouchMode;
  touchOpacity: number;
}

/** Maps each action to keyboard `KeyboardEvent.code` values. The first code is the primary binding. */
export type ControlBindings = Record<ActionId, string[]>;
