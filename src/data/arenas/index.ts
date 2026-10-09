import type { ArenaData } from '@/types';

/** Shattered Colosseum at dusk — the first arena of "A Última Arena". */
export const COLOSSEUM: ArenaData = {
  id: 'colosseum',
  nameKey: 'arenas.colosseum.name',
  descKey: 'arenas.colosseum.desc',
  width: 1800,
  floorY: 600,
  bounds: { left: 90, right: 1710 },
  spawn: { p1: 700, p2: 1100 },
  music: 'battle_colosseum',
  ambient: 'embers',
  ambientColor: 0xffa24a,
  layers: [
    { type: 'sky', top: 0x1a0f2e, bottom: 0xd2573a },
    { type: 'sun', x: 0.62, y: 330, radius: 120, color: 0xffc27a, glow: 0xff7a3a },
    {
      type: 'silhouette',
      shape: 'mountains',
      color: 0x3a1c34,
      baseY: 520,
      height: 170,
      seed: 7,
      scroll: 0.15,
      alpha: 1,
    },
    {
      type: 'silhouette',
      shape: 'arches',
      color: 0x2a1426,
      baseY: 560,
      height: 230,
      seed: 3,
      scroll: 0.35,
      alpha: 1,
    },
    {
      type: 'silhouette',
      shape: 'pillars',
      color: 0x1a0c18,
      baseY: 600,
      height: 300,
      seed: 11,
      scroll: 0.6,
      alpha: 1,
    },
    { type: 'props', kind: 'torches', color: 0xffa24a, spacing: 420, scroll: 0.8 },
    { type: 'floor', color: 0x3b2a2a, lineColor: 0x5a3e36, edgeColor: 0xf0b070, pattern: 'stone' },
  ],
};

/** Rain-soaked rooftop over a neon city — second arena, shows the arena system is data-driven. */
export const NEON_DOCK: ArenaData = {
  id: 'neon_dock',
  nameKey: 'arenas.neon_dock.name',
  descKey: 'arenas.neon_dock.desc',
  width: 1700,
  floorY: 600,
  bounds: { left: 80, right: 1620 },
  spawn: { p1: 650, p2: 1050 },
  music: 'battle_neon',
  ambient: 'rain',
  ambientColor: 0x9fd8ff,
  layers: [
    { type: 'sky', top: 0x050816, bottom: 0x24124a },
    { type: 'sun', x: 0.3, y: 160, radius: 60, color: 0xd9e4ff, glow: 0x5a6cff },
    {
      type: 'silhouette',
      shape: 'skyline',
      color: 0x161433,
      baseY: 560,
      height: 300,
      seed: 21,
      scroll: 0.2,
      alpha: 1,
    },
    {
      type: 'silhouette',
      shape: 'towers',
      color: 0x0e0d24,
      baseY: 590,
      height: 360,
      seed: 5,
      scroll: 0.45,
      alpha: 1,
    },
    { type: 'props', kind: 'lamps', color: 0x3fe0c5, spacing: 380, scroll: 0.85 },
    { type: 'floor', color: 0x1c1f2c, lineColor: 0x2e3346, edgeColor: 0x3fe0c5, pattern: 'metal' },
  ],
};

export const ARENAS: readonly ArenaData[] = [COLOSSEUM, NEON_DOCK];

export const getArena = (id: string): ArenaData => {
  const arena = ARENAS.find((a) => a.id === id);
  if (!arena) throw new Error(`Unknown arena "${id}"`);
  return arena;
};
