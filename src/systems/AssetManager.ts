import type Phaser from 'phaser';
import { Logger } from '@/utils/Logger';
import { COLORS } from '@/ui/theme';

/** One file-based asset. Every entry declares a fallback so a missing file never breaks the game. */
export interface AssetEntry {
  key: string;
  type: 'svg' | 'image';
  path: string;
  width: number;
  height: number;
  description: string;
}

export const ASSET_CATALOG: readonly AssetEntry[] = [
  {
    key: 'emblem',
    type: 'svg',
    path: 'assets/ui/emblem.svg',
    width: 256,
    height: 256,
    description: 'Game emblem/icon',
  },
];

/** Procedurally generated textures used by particles and effects. */
export const TEXTURES = {
  dot: 'fx_dot',
  glow: 'fx_glow',
  shard: 'fx_shard',
  ring: 'fx_ring',
  streak: 'fx_streak',
  rain: 'fx_rain',
  smoke: 'fx_smoke',
  ember: 'fx_ember',
} as const;

/**
 * Loads the asset catalog, records anything that failed to load and replaces it with a visible,
 * clearly-identified placeholder texture.
 */
export class AssetManager {
  readonly missing = new Set<string>();

  queue(scene: Phaser.Scene): void {
    scene.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.missing.add(file.key);
      Logger.warn('Assets', `Missing asset "${file.key}" (${file.src}); using placeholder.`);
    });
    for (const a of ASSET_CATALOG) {
      if (a.type === 'svg') scene.load.svg(a.key, a.path, { width: a.width, height: a.height });
      else scene.load.image(a.key, a.path);
    }
  }

  /** Creates placeholders for missing files. Call after the loader completes. */
  ensureFallbacks(scene: Phaser.Scene): void {
    for (const a of ASSET_CATALOG) {
      if (scene.textures.exists(a.key)) continue;
      this.missing.add(a.key);
      const g = scene.make.graphics({}, false);
      g.fillStyle(COLORS.panelHi, 1);
      g.fillRect(0, 0, a.width, a.height);
      g.lineStyle(4, COLORS.accent, 1);
      g.strokeRect(2, 2, a.width - 4, a.height - 4);
      g.lineBetween(0, 0, a.width, a.height);
      g.lineBetween(a.width, 0, 0, a.height);
      g.generateTexture(a.key, a.width, a.height);
      g.destroy();
    }
  }

  generateProceduralTextures(scene: Phaser.Scene): void {
    const make = (
      key: string,
      w: number,
      h: number,
      draw: (g: Phaser.GameObjects.Graphics) => void,
    ): void => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make(TEXTURES.dot, 16, 16, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 7);
    });
    make(TEXTURES.glow, 64, 64, (g) => {
      for (let r = 32; r > 0; r -= 2) {
        g.fillStyle(0xffffff, 0.06 + (1 - r / 32) * 0.16);
        g.fillCircle(32, 32, r);
      }
    });
    make(TEXTURES.shard, 24, 24, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(12, 0, 20, 12, 12, 24);
      g.fillTriangle(12, 0, 4, 12, 12, 24);
    });
    make(TEXTURES.ring, 64, 64, (g) => {
      g.lineStyle(5, 0xffffff, 1);
      g.strokeCircle(32, 32, 28);
    });
    make(TEXTURES.streak, 48, 8, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 2, 48, 4, 2);
    });
    make(TEXTURES.rain, 4, 28, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(1, 0, 2, 28);
    });
    make(TEXTURES.smoke, 48, 48, (g) => {
      for (let r = 24; r > 0; r -= 3) {
        g.fillStyle(0xffffff, 0.05 + (1 - r / 24) * 0.08);
        g.fillCircle(24, 24, r);
      }
    });
    make(TEXTURES.ember, 8, 8, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(2, 2, 4, 4);
    });
  }
}
