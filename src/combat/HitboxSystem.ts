import type { BoxData, Facing, Rect } from '@/types';

/** Converts a box authored facing right into a world rect for the given origin and facing. */
export const toWorldBox = (box: BoxData, originX: number, originY: number, facing: Facing): Rect => ({
  x: facing === 1 ? originX + box.x : originX - box.x - box.w,
  y: originY + box.y,
  w: box.w,
  h: box.h,
});

/** Intersection centre of two rects, used to place impact effects. */
export const overlapCenter = (a: Rect, b: Rect): { x: number; y: number } => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y, b.y);
  const top = Math.min(a.y + a.h, b.y + b.h);
  return { x: (left + right) / 2, y: (bottom + top) / 2 };
};

/** Shrinks a rect horizontally towards one side (used for limb hurtboxes during attacks). */
export const shrinkRect = (r: Rect, factor: number): Rect => {
  const w = r.w * factor;
  const h = r.h * factor;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
};
