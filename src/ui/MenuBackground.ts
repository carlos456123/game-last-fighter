import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, QUALITY_PRESETS } from '@/config/gameConfig';
import { TEXTURES } from '@/systems/AssetManager';
import { getServices } from '@/systems/Services';
import { COLORS, DEPTH } from './theme';

/**
 * Animated backdrop shared by every menu: gradient sky, slow light rays, a broken-arena
 * silhouette and subtle embers. Kept cheap and respects the particle/quality settings.
 */
export const createMenuBackground = (scene: Phaser.Scene, accent: number = COLORS.accent): void => {
  const { settings } = getServices(scene).settings;
  const g = scene.add.graphics().setDepth(DEPTH.background);
  g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bg, COLORS.bg, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const rays = scene.add.graphics().setDepth(DEPTH.background).setBlendMode('ADD');
  rays.setPosition(GAME_WIDTH * 0.5, -60);
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + i * 0.3;
    rays.fillStyle(accent, 0.035);
    rays.fillTriangle(
      0,
      0,
      Math.sin(a - 0.07) * 1400,
      Math.cos(a - 0.07) * 1400,
      Math.sin(a + 0.07) * 1400,
      Math.cos(a + 0.07) * 1400,
    );
  }
  scene.tweens.add({
    targets: rays,
    angle: { from: -4, to: 4 },
    duration: 9000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut',
  });

  // Broken arena silhouette.
  const s = scene.add.graphics().setDepth(DEPTH.background);
  s.fillStyle(0x000000, 0.55);
  const baseY = GAME_HEIGHT - 120;
  for (let x = -40; x < GAME_WIDTH + 80; x += 150) {
    const h = 120 + ((x * 37) % 90);
    s.fillRect(x, baseY - h, 34, h + 140);
    s.fillRect(x + 34, baseY - h, 116, 26);
    s.fillRect(x + 116, baseY - h * 0.7, 34, h * 0.7 + 140);
  }
  s.fillStyle(COLORS.bg, 1);
  s.fillRect(0, baseY + 40, GAME_WIDTH, 200);
  s.lineStyle(2, accent, 0.4);
  s.lineBetween(0, baseY + 40, GAME_WIDTH, baseY + 40);

  if (settings.particles) {
    const q = QUALITY_PRESETS[settings.quality];
    scene.add
      .particles(0, 0, TEXTURES.ember, {
        x: { min: 0, max: GAME_WIDTH },
        y: GAME_HEIGHT + 10,
        lifespan: 7000,
        speedY: { min: -60, max: -25 },
        speedX: { min: -12, max: 12 },
        scale: { start: 0.9, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        tint: [accent, COLORS.gold, 0xffffff],
        frequency: Math.round(9000 / q.ambientParticles),
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.background);
  }
  // Vignette for focus on the centre.
  const v = scene.add.graphics().setDepth(DEPTH.background);
  v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.55, 0.55);
  v.fillRect(0, GAME_HEIGHT * 0.55, GAME_WIDTH, GAME_HEIGHT * 0.45);
};
