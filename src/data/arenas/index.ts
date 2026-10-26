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

/** Futuristic vertical district: industrial towers, neon signs and rain. */
export const DISTRICT: ArenaData = {
  id: 'district',
  nameKey: 'arenas.district.name',
  descKey: 'arenas.district.desc',
  width: 1750,
  floorY: 600,
  bounds: { left: 85, right: 1665 },
  spawn: { p1: 675, p2: 1075 },
  music: 'battle_district',
  ambient: 'rain',
  ambientColor: 0xbfa8ff,
  layers: [
    { type: 'sky', top: 0x0b0618, bottom: 0x3a1640 },
    { type: 'sun', x: 0.7, y: 130, radius: 46, color: 0xff9ad5, glow: 0xff3fa8 },
    {
      type: 'silhouette',
      shape: 'skyline',
      color: 0x1d1236,
      baseY: 520,
      height: 340,
      seed: 33,
      scroll: 0.15,
      alpha: 1,
    },
    {
      type: 'silhouette',
      shape: 'industrial',
      color: 0x140c26,
      baseY: 575,
      height: 300,
      seed: 8,
      scroll: 0.4,
      alpha: 1,
    },
    { type: 'props', kind: 'signs', color: 0xff3fa8, spacing: 340, scroll: 0.7 },
    { type: 'floor', color: 0x1a1424, lineColor: 0x33284a, edgeColor: 0xff3fa8, pattern: 'metal' },
  ],
};

/** Ancient sanctuary of ash: ruined temple, braziers and falling ash. Final stage of the tournament. */
export const SANCTUARY: ArenaData = {
  id: 'sanctuary',
  nameKey: 'arenas.sanctuary.name',
  descKey: 'arenas.sanctuary.desc',
  width: 1800,
  floorY: 600,
  bounds: { left: 90, right: 1710 },
  spawn: { p1: 700, p2: 1100 },
  music: 'battle_sanctuary',
  ambient: 'ash',
  ambientColor: 0xc9c2b8,
  layers: [
    { type: 'sky', top: 0x120b0b, bottom: 0x5a2a1a },
    { type: 'sun', x: 0.45, y: 260, radius: 150, color: 0xb8462a, glow: 0x7a2210 },
    {
      type: 'silhouette',
      shape: 'mountains',
      color: 0x2a1512,
      baseY: 500,
      height: 200,
      seed: 19,
      scroll: 0.12,
      alpha: 1,
    },
    {
      type: 'silhouette',
      shape: 'temple',
      color: 0x1e0f0d,
      baseY: 580,
      height: 280,
      seed: 4,
      scroll: 0.38,
      alpha: 1,
    },
    { type: 'props', kind: 'braziers', color: 0xff7a2a, spacing: 460, scroll: 0.75 },
    { type: 'floor', color: 0x2e2522, lineColor: 0x4a3a33, edgeColor: 0xff7a2a, pattern: 'stone' },
  ],
};

export const ARENAS: readonly ArenaData[] = [COLOSSEUM, NEON_DOCK, DISTRICT, SANCTUARY];

export const getArena = (id: string): ArenaData => {
  const arena = ARENAS.find((a) => a.id === id);
  if (!arena) throw new Error(`Unknown arena "${id}"`);
  return arena;
};
