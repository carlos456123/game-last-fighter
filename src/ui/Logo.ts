import Phaser from 'phaser';
import { COLORS, TEXT_COLORS, textStyle } from './theme';

export type LogoVariant = 'horizontal' | 'compact';

/**
 * LAST FIGHTER logotype built from the display font plus a blade slash and the emblem.
 * "horizontal": emblem + full name. "compact": stacked name for small spaces.
 * The square emblem (public/assets/ui/emblem.svg) is the icon version.
 */
export const createLogo = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  variant: LogoVariant = 'horizontal',
): Phaser.GameObjects.Container => {
  const c = scene.add.container(x, y);
  const size = variant === 'horizontal' ? 104 : 64;
  const last = scene.add
    .text(0, -size * 0.62, 'LAST', textStyle({ font: 'display', size: size * 0.42, color: TEXT_COLORS.dim }))
    .setOrigin(0.5)
    .setLetterSpacing(size * 0.32);
  const fighter = scene.add
    .text(0, 0, 'FIGHTER', textStyle({ font: 'display', size, color: TEXT_COLORS.primary }))
    .setOrigin(0.5);
  fighter.setShadow(0, 6, '#000000', 0, false, true);
  fighter.setStroke('#120b16', 8);
  // Blade slash across the word.
  const slash = scene.add.graphics();
  const w = fighter.width;
  slash.fillStyle(COLORS.accent, 1);
  slash.fillTriangle(-w * 0.55, size * 0.38, w * 0.58, -size * 0.36, w * 0.6, -size * 0.28);
  slash.fillStyle(COLORS.gold, 1);
  slash.fillTriangle(-w * 0.5, size * 0.36, w * 0.55, -size * 0.33, w * 0.56, -size * 0.3);
  slash.setBlendMode(Phaser.BlendModes.ADD);
  const underline = scene.add.graphics();
  underline.fillStyle(COLORS.accent, 1);
  underline.fillRect(-w * 0.5, size * 0.52, w, 5);
  underline.fillStyle(COLORS.gold, 1);
  underline.fillRect(-w * 0.5, size * 0.52, w * 0.18, 5);
  c.add([last, fighter, slash, underline]);
  if (variant === 'horizontal' && scene.textures.exists('emblem')) {
    const emblem = scene.add
      .image(-w / 2 - size * 0.75, -size * 0.1, 'emblem')
      .setDisplaySize(size * 1.15, size * 1.15);
    c.add(emblem);
  }
  return c;
};
