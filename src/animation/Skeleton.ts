import type { BodyData } from '@/types';
import type { Pose } from './PoseLibrary';

export interface Vec {
  x: number;
  y: number;
}

/** Solved joint positions in local space (facing right, y up, origin at the feet). */
export interface Skeleton {
  hip: Vec;
  neck: Vec;
  head: Vec;
  headR: number;
  shoulderF: Vec;
  shoulderB: Vec;
  elbowF: Vec;
  elbowB: Vec;
  handF: Vec;
  handB: Vec;
  hipF: Vec;
  hipB: Vec;
  kneeF: Vec;
  kneeB: Vec;
  footF: Vec;
  footB: Vec;
  /** Torso direction (unit vector, hip → neck). */
  up: Vec;
  /** Forward direction perpendicular to the torso. */
  forward: Vec;
}

const DEG = Math.PI / 180;
const JOINTS = [
  'neck',
  'head',
  'shoulderF',
  'shoulderB',
  'elbowF',
  'elbowB',
  'handF',
  'handB',
  'hipF',
  'hipB',
  'kneeF',
  'kneeB',
  'footF',
  'footB',
] as const;

const rotate = (p: Vec, origin: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
};

/**
 * Two-bone IK. Returns the middle joint. `prefer` chooses between the two solutions
 * (e.g. knees forward, elbows down).
 */
export const solveIK = (root: Vec, target: Vec, a: number, b: number, prefer: (j: Vec) => number): Vec => {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = Math.max(1e-3, Math.min(a + b - 1e-3, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const cos = (a * a + dist * dist - b * b) / (2 * a * dist);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cos)));
  const j1 = { x: root.x + Math.cos(base + alpha) * a, y: root.y + Math.sin(base + alpha) * a };
  const j2 = { x: root.x + Math.cos(base - alpha) * a, y: root.y + Math.sin(base - alpha) * a };
  return prefer(j1) >= prefer(j2) ? j1 : j2;
};

/** Clamp an end effector so the limb never stretches beyond its length. */
const reach = (root: Vec, target: Vec, length: number): Vec => {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.hypot(dx, dy);
  if (d <= length) return target;
  return { x: root.x + (dx / d) * length, y: root.y + (dy / d) * length };
};

/** Applies the fighter's stance style (wider stance, higher guard, more lean) to a pose. */
export const stylePose = (pose: Pose, body: BodyData): Pose => ({
  ...pose,
  lean: pose.lean + (body.lean - 6) * 0.6,
  footF: [pose.footF[0] * body.stanceWidth, pose.footF[1]],
  footB: [pose.footB[0] * body.stanceWidth, pose.footB[1]],
  handF: [pose.handF[0], pose.handF[1] > 0 ? pose.handF[1] * body.guardHeight : pose.handF[1]],
  handB: [pose.handB[0], pose.handB[1] > 0 ? pose.handB[1] * body.guardHeight : pose.handB[1]],
});

export const solveSkeleton = (body: BodyData, rawPose: Pose): Skeleton => {
  const pose = stylePose(rawPose, body);
  const L = body.height * body.legRatio;
  const A = body.height * body.armRatio;
  const torso = body.height * body.torsoRatio;
  const headR = body.height * body.headRatio;
  const thigh = L * 0.5;
  const upperArm = A * 0.5;

  const hip = { x: pose.hipX * L, y: pose.hipY * L };
  const lean = pose.lean * DEG;
  const up = { x: Math.sin(lean), y: Math.cos(lean) };
  const forward = { x: up.y, y: -up.x };
  const neck = { x: hip.x + up.x * torso, y: hip.y + up.y * torso };
  const headDir = (pose.lean + pose.head) * DEG;
  const head = {
    x: neck.x + Math.sin(headDir) * headR * 1.35,
    y: neck.y + Math.cos(headDir) * headR * 1.35,
  };
  const shoulderBase = { x: neck.x - up.x * torso * 0.1, y: neck.y - up.y * torso * 0.1 };
  const sw = body.shoulderWidth * 0.28;
  const hw = body.hipWidth * 0.25;
  const shoulderF = { x: shoulderBase.x + forward.x * sw, y: shoulderBase.y + forward.y * sw };
  const shoulderB = { x: shoulderBase.x - forward.x * sw, y: shoulderBase.y - forward.y * sw };
  const hipF = { x: hip.x + forward.x * hw, y: hip.y + forward.y * hw };
  const hipB = { x: hip.x - forward.x * hw, y: hip.y - forward.y * hw };

  const handF = reach(
    shoulderF,
    { x: shoulderF.x + pose.handF[0] * A, y: shoulderF.y + pose.handF[1] * A },
    A,
  );
  const handB = reach(
    shoulderB,
    { x: shoulderB.x + pose.handB[0] * A, y: shoulderB.y + pose.handB[1] * A },
    A,
  );
  const elbowDown = (j: Vec): number => -j.y;
  const elbowF = solveIK(shoulderF, handF, upperArm, upperArm, elbowDown);
  const elbowB = solveIK(shoulderB, handB, upperArm, upperArm, elbowDown);

  const footF = reach(hipF, { x: pose.footF[0] * L, y: pose.footF[1] * L }, L);
  const footB = reach(hipB, { x: pose.footB[0] * L, y: pose.footB[1] * L }, L);
  const kneeForward = (j: Vec): number => j.x;
  const kneeF = solveIK(hipF, footF, thigh, thigh, kneeForward);
  const kneeB = solveIK(hipB, footB, thigh, thigh, kneeForward);

  const sk: Skeleton = {
    hip,
    neck,
    head,
    headR,
    shoulderF,
    shoulderB,
    elbowF,
    elbowB,
    handF,
    handB,
    hipF,
    hipB,
    kneeF,
    kneeB,
    footF,
    footB,
    up,
    forward,
  };
  if (pose.rot !== 0) {
    const angle = pose.rot * DEG;
    for (const key of JOINTS) sk[key] = rotate(sk[key], hip, angle);
    sk.up = rotate(sk.up, { x: 0, y: 0 }, angle);
    sk.forward = rotate(sk.forward, { x: 0, y: 0 }, angle);
  }
  return sk;
};
