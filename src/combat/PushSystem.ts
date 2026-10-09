import type { Character, WorldBounds } from '@/characters/Character';
import { rectsOverlap } from '@/utils/MathUtils';

/**
 * Physical separation between fighters (pushboxes) and arena limits.
 * Kept apart from hit detection so each can be tuned independently.
 */
export const clampToBounds = (fighter: Character, bounds: WorldBounds): boolean => {
  const half = fighter.data.body.width * 0.4;
  if (fighter.x - half < bounds.left) {
    fighter.x = bounds.left + half;
    return true;
  }
  if (fighter.x + half > bounds.right) {
    fighter.x = bounds.right - half;
    return true;
  }
  return false;
};

export const isCornered = (fighter: Character, bounds: WorldBounds, margin = 40): boolean => {
  const half = fighter.data.body.width * 0.4;
  return fighter.x - half <= bounds.left + margin || fighter.x + half >= bounds.right - margin;
};

export const resolvePush = (a: Character, b: Character, bounds: WorldBounds): void => {
  const pa = a.pushbox();
  const pb = b.pushbox();
  if (rectsOverlap(pa, pb)) {
    const overlap = Math.min(pa.x + pa.w, pb.x + pb.w) - Math.max(pa.x, pb.x);
    // Decide direction by centre; if exactly stacked use facing so the result is deterministic.
    const dir = a.x === b.x ? -a.facing : a.x < b.x ? -1 : 1;
    a.x += (dir * overlap) / 2;
    b.x -= (dir * overlap) / 2;
  }
  const aWall = clampToBounds(a, bounds);
  const bWall = clampToBounds(b, bounds);
  // If one fighter is pinned to a wall, push the other one out instead.
  if (aWall || bWall) {
    const pa2 = a.pushbox();
    const pb2 = b.pushbox();
    if (rectsOverlap(pa2, pb2)) {
      const overlap = Math.min(pa2.x + pa2.w, pb2.x + pb2.w) - Math.max(pa2.x, pb2.x);
      const pushed = aWall ? b : a;
      const pinned = aWall ? a : b;
      pushed.x += (pushed.x >= pinned.x ? 1 : -1) * overlap;
      clampToBounds(pushed, bounds);
    }
  }
};
