/**
 * Key poses for the procedural fighter rig.
 *
 * Units: feet and hip are in leg-lengths (L), hands are relative to the shoulder in
 * arm-lengths (A). +x is towards the opponent, +y is up. `lean` tilts the torso forward,
 * `rot` rotates the whole body around the hip backwards (knockdowns, flips).
 */
export interface Pose {
  hipX: number;
  hipY: number;
  lean: number;
  head: number;
  rot: number;
  footF: [number, number];
  footB: [number, number];
  handF: [number, number];
  handB: [number, number];
}

export type Keyframe = [t: number, pose: Pose];
export interface AnimationDef {
  keys: Keyframe[];
  loop: boolean;
}

export const STANCE: Pose = {
  hipX: 0,
  hipY: 0.9,
  lean: 6,
  head: 0,
  rot: 0,
  footF: [0.3, 0],
  footB: [-0.3, 0],
  handF: [0.42, 0.2],
  handB: [0.26, 0.1],
};

const P = (o: Partial<Pose>, base: Pose = STANCE): Pose => ({ ...base, ...o });

const CROUCH = P({
  hipY: 0.56,
  lean: 18,
  footF: [0.38, 0],
  footB: [-0.36, 0],
  handF: [0.42, 0.24],
  handB: [0.3, 0.14],
});
const AIR = P({
  hipY: 1,
  lean: 2,
  footF: [0.18, 0.28],
  footB: [-0.16, 0.38],
  handF: [0.36, 0.36],
  handB: [0.1, 0.3],
});
const LYING = P({
  rot: 88,
  hipY: 0.14,
  hipX: 0,
  lean: 0,
  head: 10,
  footF: [0.2, 0],
  footB: [-0.15, 0],
  handF: [-0.4, -0.6],
  handB: [-0.3, -0.9],
});

/** Shorthand for move animations: wind-up during startup, strike during active, return in recovery. */
const strike = (windup: Partial<Pose>, hit: Partial<Pose>, base: Pose = STANCE): AnimationDef => ({
  loop: false,
  keys: [
    [0, base],
    [0.32, P(windup, base)],
    [0.42, P(hit, base)],
    [0.62, P(hit, base)],
    [1, base],
  ],
});

export const ANIMATIONS: Record<string, AnimationDef> = {
  idle: {
    loop: true,
    keys: [
      [0, STANCE],
      [0.5, P({ hipY: 0.88, lean: 7, handF: [0.4, 0.16], handB: [0.25, 0.06] })],
      [1, STANCE],
    ],
  },
  walk: {
    loop: true,
    keys: [
      [0, P({ footF: [0.42, 0], footB: [-0.22, 0.05] })],
      [0.25, P({ hipY: 0.92, footF: [0.16, 0.08], footB: [-0.1, 0] })],
      [0.5, P({ footF: [0.24, 0.02], footB: [-0.42, 0] })],
      [0.75, P({ hipY: 0.92, footF: [0.05, 0], footB: [-0.12, 0.1] })],
      [1, P({ footF: [0.42, 0], footB: [-0.22, 0.05] })],
    ],
  },
  run: {
    loop: true,
    keys: [
      [
        0,
        P({
          lean: 24,
          hipY: 0.86,
          footF: [0.6, 0.02],
          footB: [-0.4, 0.22],
          handF: [0.5, 0.1],
          handB: [-0.3, -0.1],
        }),
      ],
      [
        0.5,
        P({
          lean: 24,
          hipY: 0.9,
          footF: [-0.35, 0.25],
          footB: [0.55, 0.02],
          handF: [-0.25, -0.1],
          handB: [0.5, 0.15],
        }),
      ],
      [
        1,
        P({
          lean: 24,
          hipY: 0.86,
          footF: [0.6, 0.02],
          footB: [-0.4, 0.22],
          handF: [0.5, 0.1],
          handB: [-0.3, -0.1],
        }),
      ],
    ],
  },
  prejump: {
    loop: false,
    keys: [
      [0, CROUCH],
      [1, CROUCH],
    ],
  },
  jump: {
    loop: false,
    keys: [
      [0, P({ hipY: 1, footF: [0.1, 0.05], footB: [-0.1, 0.1] })],
      [1, AIR],
    ],
  },
  fall: {
    loop: false,
    keys: [
      [0, AIR],
      [1, P({ hipY: 1, footF: [0.25, 0.05], footB: [-0.22, 0.12], handF: [0.45, 0.4], handB: [-0.2, 0.45] })],
    ],
  },
  crouch: {
    loop: true,
    keys: [
      [0, CROUCH],
      [0.5, P({ hipY: 0.54 }, CROUCH)],
      [1, CROUCH],
    ],
  },
  block: {
    loop: false,
    keys: [
      [0, P({ lean: -4, hipY: 0.86, handF: [0.3, 0.42], handB: [0.24, 0.46], head: -6 })],
      [1, P({ lean: -4, hipY: 0.86, handF: [0.3, 0.42], handB: [0.24, 0.46], head: -6 })],
    ],
  },
  crouch_block: {
    loop: false,
    keys: [
      [0, P({ handF: [0.3, 0.4], handB: [0.22, 0.44], lean: 10 }, CROUCH)],
      [1, P({ handF: [0.3, 0.4], handB: [0.22, 0.44], lean: 10 }, CROUCH)],
    ],
  },
  dodge: {
    loop: false,
    keys: [
      [
        0,
        P({
          hipY: 0.62,
          lean: 34,
          footF: [0.6, 0],
          footB: [-0.5, 0.05],
          handF: [-0.1, -0.2],
          handB: [-0.4, -0.1],
        }),
      ],
      [
        0.7,
        P({
          hipY: 0.6,
          lean: 30,
          footF: [0.55, 0],
          footB: [-0.55, 0.1],
          handF: [-0.2, -0.3],
          handB: [-0.5, -0.2],
        }),
      ],
      [1, STANCE],
    ],
  },
  hit: {
    loop: false,
    keys: [
      [0, P({ lean: -24, head: -22, hipX: -0.08, hipY: 0.86, handF: [0.1, -0.15], handB: [-0.2, -0.05] })],
      [1, P({ lean: -10, head: -8, hipX: -0.03, handF: [0.3, 0.05], handB: [0.1, 0] })],
    ],
  },
  hit_air: {
    loop: false,
    keys: [
      [
        0,
        P({
          rot: 30,
          lean: -20,
          head: -30,
          footF: [0.4, 0.3],
          footB: [0.25, 0.45],
          handF: [-0.3, 0.5],
          handB: [-0.5, 0.3],
        }),
      ],
      [
        1,
        P({
          rot: 60,
          lean: -10,
          head: -20,
          footF: [0.45, 0.2],
          footB: [0.3, 0.3],
          handF: [-0.4, 0.3],
          handB: [-0.6, 0.1],
        }),
      ],
    ],
  },
  knockdown: {
    loop: false,
    keys: [
      [0, P({ rot: 60, hipY: 0.3 }, LYING)],
      [0.25, LYING],
      [1, LYING],
    ],
  },
  wakeup: {
    loop: false,
    keys: [
      [0, LYING],
      [0.5, P({ rot: 40, hipY: 0.4, lean: 30, handF: [0.1, -0.7], handB: [-0.2, -0.8] })],
      [1, STANCE],
    ],
  },
  stun: {
    loop: true,
    keys: [
      [0, P({ lean: 14, head: 18, hipY: 0.84, handF: [0.1, -0.6], handB: [-0.05, -0.65] })],
      [0.5, P({ lean: -6, head: -16, hipY: 0.86, handF: [0.0, -0.65], handB: [-0.1, -0.6] })],
      [1, P({ lean: 14, head: 18, hipY: 0.84, handF: [0.1, -0.6], handB: [-0.05, -0.65] })],
    ],
  },
  defeat_kneel: {
    loop: false,
    keys: [
      [0, P({ lean: 20, head: 20 })],
      [
        1,
        P({
          hipY: 0.42,
          lean: 38,
          head: 32,
          footF: [0.38, 0],
          footB: [-0.42, 0],
          handF: [0.15, -0.85],
          handB: [0.05, -0.9],
        }),
      ],
    ],
  },
  victory_fist: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.4,
        P({
          lean: -6,
          head: -14,
          handF: [0.18, 1.0],
          handB: [0.2, -0.4],
          footF: [0.24, 0],
          footB: [-0.24, 0],
          hipY: 0.96,
        }),
      ],
      [
        1,
        P({
          lean: -4,
          head: -12,
          handF: [0.16, 1.0],
          handB: [0.2, -0.45],
          footF: [0.24, 0],
          footB: [-0.24, 0],
          hipY: 0.97,
        }),
      ],
    ],
  },
  victory_flex: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.4,
        P({
          lean: 0,
          hipY: 0.9,
          handF: [0.42, 0.62],
          handB: [-0.42, 0.62],
          footF: [0.4, 0],
          footB: [-0.4, 0],
        }),
      ],
      [
        1,
        P({
          lean: 2,
          hipY: 0.88,
          handF: [0.4, 0.66],
          handB: [-0.4, 0.66],
          footF: [0.4, 0],
          footB: [-0.4, 0],
        }),
      ],
    ],
  },
  victory_blades: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.4,
        P({
          lean: 10,
          head: -6,
          hipY: 0.84,
          handF: [0.6, -0.3],
          handB: [-0.55, -0.35],
          footF: [0.42, 0],
          footB: [-0.36, 0],
        }),
      ],
      [
        1,
        P({
          lean: 12,
          head: -4,
          hipY: 0.82,
          handF: [0.62, -0.32],
          handB: [-0.58, -0.36],
          footF: [0.42, 0],
          footB: [-0.36, 0],
        }),
      ],
    ],
  },

  // ---------------------------------------------------------------- normals
  jab: strike({ handF: [0.28, 0.16], lean: 4 }, { handF: [0.98, 0.14], lean: 14, hipX: 0.05 }),
  cross: strike(
    { handB: [0.05, 0.1], lean: 8 },
    { handB: [1.0, 0.14], handF: [0.22, 0.26], lean: 20, hipX: 0.1, footB: [-0.36, 0.04] },
  ),
  roundhouse: strike(
    { footF: [0.3, 0.45], lean: -8, handF: [0.3, 0.3] },
    { footF: [1.02, 1.12], lean: -22, hipY: 0.92, handF: [0.1, 0.35], handB: [-0.2, 0.25], footB: [-0.1, 0] },
  ),
  heavy_punch: strike(
    { handF: [-0.15, 0.18], lean: -10, hipX: -0.06 },
    { handF: [1.06, 0.06], handB: [0.0, 0.2], lean: 26, hipX: 0.16, footF: [0.52, 0], footB: [-0.42, 0] },
  ),
  crouch_jab: strike({ handF: [0.25, 0.1] }, { handF: [0.98, -0.18], lean: 26 }, CROUCH),
  sweep: strike(
    { hipY: 0.48, lean: 30 },
    { footF: [1.18, 0.04], hipY: 0.44, lean: 34, handF: [0.3, -0.6], handB: [0.1, -0.7] },
    CROUCH,
  ),
  air_kick: strike({ footF: [0.3, 0.5] }, { footF: [0.86, 0.28], footB: [-0.2, 0.42], lean: -14 }, AIR),
  air_heavy: strike(
    { handF: [0.2, 0.7], handB: [0.1, 0.7], lean: -10 },
    { handF: [0.82, -0.32], handB: [0.72, -0.28], lean: 34 },
    AIR,
  ),
  hammer: strike(
    { handF: [0.22, 1.0], handB: [0.12, 0.96], lean: -10 },
    { handF: [0.85, -0.1], handB: [0.75, -0.08], lean: 34, hipX: 0.08 },
  ),
  double_smash: strike(
    { handF: [-0.1, 0.95], handB: [-0.2, 0.9], lean: -18, hipX: -0.08 },
    { handF: [1.0, 0.0], handB: [0.92, 0.04], lean: 38, hipX: 0.16, footF: [0.55, 0] },
  ),
  stomp: strike(
    { footF: [0.45, 0.6], lean: -6, hipY: 0.95 },
    { footF: [0.7, 0.0], hipY: 0.78, lean: 16, handF: [0.3, 0.5], handB: [-0.3, 0.5] },
  ),
  air_elbow: strike({ handF: [0.1, 0.4] }, { handF: [0.4, -0.15], lean: 28 }, AIR),
  air_crush: strike(
    { handF: [0.2, 0.9], handB: [0.1, 0.9] },
    { handF: [0.45, -0.95], handB: [0.35, -0.9], lean: 48 },
    AIR,
  ),
  slash_a: strike({ handF: [0.05, 0.75], lean: 0 }, { handF: [0.92, -0.05], lean: 20, hipX: 0.06 }),
  slash_b: strike({ handB: [0.3, -0.5] }, { handB: [0.96, 0.4], handF: [0.3, 0.2], lean: 16 }),
  spin_slash: {
    loop: false,
    keys: [
      [0, STANCE],
      [0.3, P({ lean: 10, handF: [-0.5, 0.2], handB: [0.5, 0.2] })],
      [0.42, P({ lean: 18, handF: [0.95, 0.15], handB: [-0.9, 0.15], hipY: 0.84 })],
      [0.5, P({ lean: 18, handF: [-0.9, 0.2], handB: [0.95, 0.15], hipY: 0.84 })],
      [0.6, P({ lean: 18, handF: [0.95, 0.15], handB: [-0.9, 0.15], hipY: 0.84 })],
      [1, STANCE],
    ],
  },
  rising_cross: strike(
    { hipY: 0.65, lean: 20, handF: [0.2, -0.5], handB: [0.1, -0.5] },
    { hipY: 1.0, lean: 0, handF: [0.5, 1.0], handB: [0.62, 0.92], footF: [0.15, 0.1], footB: [-0.2, 0.2] },
  ),
  slide: strike(
    { hipY: 0.5, lean: 20 },
    { rot: 32, hipY: 0.3, footF: [1.1, 0.0], footB: [0.35, 0.05], handF: [-0.3, -0.2], handB: [-0.6, -0.3] },
    CROUCH,
  ),
  air_slash: strike({ handF: [0.1, 0.7] }, { handF: [0.85, -0.25], lean: 24 }, AIR),
  dive: strike(
    { handF: [0.2, 0.5], lean: 10 },
    { lean: 52, handF: [0.75, -0.55], handB: [0.65, -0.6], footF: [-0.2, 0.45], footB: [-0.4, 0.35] },
    AIR,
  ),

  // ---------------------------------------------------------------- specials
  cast_forward: strike(
    { handF: [-0.15, -0.3], handB: [-0.25, -0.25], lean: -6, hipX: -0.05 },
    { handF: [0.98, 0.08], handB: [0.88, 0.02], lean: 20, hipX: 0.1, footF: [0.5, 0] },
  ),
  uppercut: strike(
    { hipY: 0.66, lean: 24, handF: [0.2, -0.35] },
    { hipY: 1.02, lean: 4, handF: [0.32, 1.02], handB: [0.0, -0.3], footF: [0.15, 0.3], footB: [-0.15, 0.1] },
  ),
  ground_slam: strike(
    { handF: [0.2, 1.0], handB: [0.1, 1.0], lean: -12, hipY: 0.96 },
    { handF: [0.7, -1.05], handB: [0.6, -1.05], lean: 54, hipY: 0.56, footF: [0.5, 0], footB: [-0.5, 0] },
  ),
  shoulder_charge: strike(
    { lean: 20, hipY: 0.8 },
    {
      lean: 42,
      hipY: 0.8,
      head: 20,
      handF: [0.15, -0.15],
      handB: [-0.25, -0.05],
      footF: [0.55, 0],
      footB: [-0.55, 0.05],
    },
  ),
  throw: strike({ handF: [-0.25, 0.45], lean: -8 }, { handF: [0.95, 0.32], lean: 16, hipX: 0.06 }),
  blink_strike: strike(
    { hipY: 0.6, lean: 30, handF: [-0.2, 0.2], handB: [-0.4, 0.1] },
    { handF: [0.95, 0.1], handB: [0.8, -0.1], lean: 26, hipX: 0.1, footF: [0.55, 0] },
  ),
  ultimate_rush: strike(
    { hipY: 0.7, lean: 0, handF: [0.25, 0.3], handB: [0.2, 0.32], head: -10 },
    { handF: [1.02, 0.1], handB: [-0.1, 0.0], lean: 36, hipX: 0.12, footF: [0.6, 0], footB: [-0.6, 0.1] },
  ),
  ultimate_quake: strike(
    {
      hipY: 1.0,
      lean: -16,
      handF: [0.1, 1.05],
      handB: [0.0, 1.05],
      head: -20,
      footF: [0.35, 0],
      footB: [-0.35, 0],
    },
    { handF: [0.75, -1.05], handB: [0.65, -1.05], lean: 58, hipY: 0.5, footF: [0.55, 0], footB: [-0.55, 0] },
  ),
  ultimate_eclipse: strike(
    { hipY: 0.62, lean: 22, handF: [0.25, 0.35], handB: [0.3, 0.3] },
    { handF: [0.96, 0.2], handB: [-0.8, 0.0], lean: 28, hipX: 0.1, footF: [0.55, 0] },
  ),
  // ---------------------------------------------------------------- expansion roster
  katana_slash: strike(
    { handF: [-0.2, 0.75], handB: [-0.1, 0.7], lean: -6 },
    { handF: [0.95, 0.0], handB: [0.75, 0.05], lean: 24, hipX: 0.1, footF: [0.5, 0] },
  ),
  iaido: strike(
    { hipY: 0.66, lean: 28, handF: [-0.3, -0.2], handB: [-0.2, -0.25], footF: [0.45, 0], footB: [-0.45, 0] },
    {
      hipY: 0.7,
      lean: 30,
      handF: [1.0, 0.1],
      handB: [-0.6, 0.0],
      hipX: 0.2,
      footF: [0.7, 0],
      footB: [-0.5, 0],
    },
  ),
  dash_slash: {
    loop: false,
    keys: [
      [0, STANCE],
      [0.18, P({ lean: -14, hipY: 0.8, handF: [0.2, 0.5], footF: [0.1, 0.05], footB: [-0.55, 0] })],
      [
        0.36,
        P({
          lean: 36,
          hipY: 0.6,
          handF: [-0.4, -0.1],
          handB: [-0.5, -0.2],
          footF: [0.6, 0],
          footB: [-0.6, 0.05],
        }),
      ],
      [
        0.45,
        P({
          lean: 34,
          hipY: 0.62,
          handF: [1.0, 0.05],
          handB: [-0.7, -0.1],
          footF: [0.65, 0],
          footB: [-0.6, 0.05],
        }),
      ],
      [
        0.62,
        P({
          lean: 30,
          hipY: 0.64,
          handF: [0.95, 0.0],
          handB: [-0.7, -0.1],
          footF: [0.6, 0],
          footB: [-0.55, 0],
        }),
      ],
      [1, STANCE],
    ],
  },
  crescent_flip: {
    loop: false,
    keys: [
      [0, CROUCH],
      [
        0.25,
        P({ rot: -120, hipY: 1, footF: [0.2, 0.4], footB: [0.0, 0.5], handF: [0.4, 0.6], handB: [0.2, 0.6] }),
      ],
      [
        0.42,
        P({ rot: -260, hipY: 1, footF: [0.5, 0.2], footB: [0.1, 0.4], handF: [0.9, 0.2], handB: [0.4, 0.2] }),
      ],
      [
        0.6,
        P(
          {
            rot: -360,
            hipY: 1,
            footF: [0.3, 0.1],
            footB: [-0.2, 0.2],
            handF: [0.8, -0.3],
            handB: [0.5, -0.3],
          },
          AIR,
        ),
      ],
      [1, P({}, AIR)],
    ],
  },
  spear_thrust: strike(
    { handF: [0.1, 0.15], handB: [-0.2, 0.1], lean: -4, hipX: -0.04 },
    { handF: [1.05, 0.1], handB: [0.45, 0.1], lean: 22, hipX: 0.14, footF: [0.55, 0], footB: [-0.45, 0] },
  ),
  spear_sweep: strike(
    { handF: [-0.4, 0.8], handB: [-0.2, 0.6], lean: -16 },
    { handF: [0.9, -0.2], handB: [0.5, 0.0], lean: 30, hipY: 0.8, footF: [0.5, 0] },
  ),
  javelin_throw: strike(
    { handF: [-0.5, 0.65], handB: [0.4, 0.3], lean: -18, hipX: -0.08, footB: [-0.45, 0] },
    { handF: [1.0, 0.4], handB: [-0.3, -0.1], lean: 22, hipX: 0.12, footF: [0.5, 0] },
  ),
  shield_bash: strike(
    { handF: [0.25, 0.35], handB: [0.2, 0.3], lean: 10, hipY: 0.82 },
    {
      handF: [0.75, 0.3],
      handB: [0.6, 0.25],
      lean: 34,
      hipY: 0.82,
      head: 10,
      footF: [0.6, 0],
      footB: [-0.55, 0.05],
    },
  ),
  ultimate_dive: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.2,
        P({
          hipY: 1,
          lean: -10,
          handF: [0.3, 1.0],
          handB: [-0.4, 0.6],
          footF: [0.1, 0.3],
          footB: [-0.2, 0.2],
        }),
      ],
      [
        0.4,
        P({
          hipY: 1,
          lean: 50,
          handF: [0.9, -0.6],
          handB: [0.6, -0.5],
          footF: [-0.2, 0.4],
          footB: [-0.4, 0.5],
        }),
      ],
      [
        0.62,
        P({ hipY: 0.8, lean: 40, handF: [0.9, -0.7], handB: [0.6, -0.6], footF: [0.4, 0], footB: [-0.5, 0] }),
      ],
      [1, STANCE],
    ],
  },
  palm_strike: strike(
    { handF: [0.15, 0.2], handB: [0.3, 0.1], lean: 0, hipY: 0.82 },
    {
      handF: [0.98, 0.1],
      handB: [-0.1, 0.0],
      lean: 14,
      hipY: 0.8,
      hipX: 0.08,
      footF: [0.5, 0],
      footB: [-0.45, 0],
    },
  ),
  counter_stance: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.08,
        P({
          hipY: 0.74,
          lean: -4,
          handF: [0.55, 0.3],
          handB: [0.25, 0.55],
          footF: [0.4, 0],
          footB: [-0.42, 0],
        }),
      ],
      [
        0.55,
        P({
          hipY: 0.72,
          lean: -6,
          handF: [0.58, 0.32],
          handB: [0.24, 0.58],
          footF: [0.4, 0],
          footB: [-0.42, 0],
        }),
      ],
      [
        0.62,
        P({ hipY: 0.78, lean: 24, handF: [1.0, 0.15], handB: [-0.2, 0.0], hipX: 0.12, footF: [0.55, 0] }),
      ],
      [1, STANCE],
    ],
  },
  tiger_step: strike(
    { hipY: 0.62, lean: 30, handF: [0.2, 0.0], handB: [-0.3, -0.1], footF: [0.5, 0], footB: [-0.5, 0] },
    {
      hipY: 0.76,
      lean: 28,
      handF: [1.0, 0.25],
      handB: [0.9, 0.0],
      hipX: 0.15,
      footF: [0.6, 0],
      footB: [-0.5, 0],
    },
  ),
  cannon_shot: strike(
    { handF: [0.3, 0.2], handB: [0.4, 0.25], lean: -8, hipX: -0.05 },
    { handF: [0.95, 0.15], handB: [0.7, 0.18], lean: -2, hipX: -0.08, footF: [0.45, 0], footB: [-0.5, 0] },
  ),
  booster: strike(
    { hipY: 0.66, lean: 18, handF: [0.3, -0.2], handB: [-0.2, -0.3] },
    { hipY: 1, lean: 0, handF: [0.35, 1.0], handB: [0.0, -0.4], footF: [0.1, 0.25], footB: [-0.15, 0.15] },
  ),
  beam: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.3,
        P({
          hipY: 0.84,
          lean: -14,
          handF: [0.3, 0.4],
          handB: [0.3, 0.42],
          footF: [0.5, 0],
          footB: [-0.55, 0],
        }),
      ],
      [
        0.4,
        P({
          hipY: 0.8,
          lean: -6,
          handF: [1.0, 0.18],
          handB: [0.85, 0.2],
          footF: [0.55, 0],
          footB: [-0.6, 0],
        }),
      ],
      [
        0.6,
        P({
          hipY: 0.8,
          lean: -8,
          handF: [1.0, 0.18],
          handB: [0.85, 0.2],
          footF: [0.55, 0],
          footB: [-0.6, 0],
        }),
      ],
      [1, STANCE],
    ],
  },
  staff_strike: strike(
    { handF: [-0.1, 0.5], handB: [0.2, 0.3], lean: -6 },
    { handF: [0.95, 0.15], handB: [0.4, 0.2], lean: 18, hipX: 0.08, footF: [0.5, 0] },
  ),
  staff_spin: {
    loop: false,
    keys: [
      [0, STANCE],
      [0.3, P({ handF: [0.5, 0.9], handB: [-0.4, -0.2], lean: 0 })],
      [0.42, P({ handF: [0.9, 0.0], handB: [-0.9, 0.2], lean: 10, hipY: 0.84 })],
      [0.5, P({ handF: [-0.4, -0.6], handB: [0.5, 0.9], lean: 10, hipY: 0.84 })],
      [0.6, P({ handF: [0.9, 0.1], handB: [-0.9, 0.1], lean: 12, hipY: 0.84 })],
      [1, STANCE],
    ],
  },
  orb_cast: strike(
    { handF: [0.3, 0.8], handB: [-0.2, 0.7], lean: -10, head: -10 },
    { handF: [0.95, 0.35], handB: [0.6, 0.5], lean: 8, footF: [0.42, 0] },
  ),
  victory_bow: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.4,
        P({
          lean: 34,
          head: 20,
          hipY: 0.92,
          handF: [0.25, 0.25],
          handB: [0.25, 0.27],
          footF: [0.12, 0],
          footB: [-0.12, 0],
        }),
      ],
      [
        1,
        P({
          lean: 30,
          head: 18,
          hipY: 0.93,
          handF: [0.24, 0.26],
          handB: [0.24, 0.28],
          footF: [0.12, 0],
          footB: [-0.12, 0],
        }),
      ],
    ],
  },
  victory_cast: {
    loop: false,
    keys: [
      [0, STANCE],
      [
        0.4,
        P({
          lean: -8,
          head: -18,
          hipY: 0.96,
          handF: [0.5, 0.9],
          handB: [-0.5, 0.85],
          footF: [0.2, 0],
          footB: [-0.2, 0],
        }),
      ],
      [
        1,
        P({
          lean: -6,
          head: -16,
          hipY: 0.97,
          handF: [0.48, 0.92],
          handB: [-0.48, 0.88],
          footF: [0.2, 0],
          footB: [-0.2, 0],
        }),
      ],
    ],
  },
  flurry: {
    loop: true,
    keys: [
      [0, P({ lean: 24, hipX: 0.08, handF: [1.0, 0.18], handB: [0.1, 0.2] })],
      [0.5, P({ lean: 26, hipX: 0.1, handF: [0.15, 0.2], handB: [1.0, 0.1] })],
      [1, P({ lean: 24, hipX: 0.08, handF: [1.0, 0.18], handB: [0.1, 0.2] })],
    ],
  },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
];
const smooth = (t: number): number => t * t * (3 - 2 * t);

export const blendPose = (a: Pose, b: Pose, t: number): Pose => ({
  hipX: lerp(a.hipX, b.hipX, t),
  hipY: lerp(a.hipY, b.hipY, t),
  lean: lerp(a.lean, b.lean, t),
  head: lerp(a.head, b.head, t),
  rot: lerp(a.rot, b.rot, t),
  footF: lerp2(a.footF, b.footF, t),
  footB: lerp2(a.footB, b.footB, t),
  handF: lerp2(a.handF, b.handF, t),
  handB: lerp2(a.handB, b.handB, t),
});

/** Samples an animation at normalised time t (0..1). Unknown animations fall back to the stance. */
export const samplePose = (name: string, t: number): Pose => {
  const anim = ANIMATIONS[name];
  if (!anim) return STANCE;
  const keys = anim.keys;
  const time = anim.loop ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i];
    const [t1, p1] = keys[i + 1];
    if (time >= t0 && time <= t1) {
      const local = t1 === t0 ? 1 : (time - t0) / (t1 - t0);
      return blendPose(p0, p1, smooth(local));
    }
  }
  return keys[keys.length - 1][1];
};
