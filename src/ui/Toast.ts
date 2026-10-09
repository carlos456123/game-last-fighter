import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config/gameConfig';
import { COLORS, DEPTH, TYPE, textStyle } from './theme';

/** Short notification banner at the top of the screen (save issues, remap feedback...). */
export const showToast = (
  scene: Phaser.Scene,
  message: string,
  color: number = COLORS.accent,
  ms = 2600,
): void => {
  const text = scene.add
    .text(GAME_WIDTH / 2, 40, message, textStyle({ size: TYPE.small, align: 'center', wrap: 760 }))
    .setOrigin(0.5);
  const pad = 18;
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.panel, 0.96);
  bg.fillRoundedRect(
    GAME_WIDTH / 2 - text.width / 2 - pad,
    40 - text.height / 2 - 10,
    text.width + pad * 2,
    text.height + 20,
    8,
  );
  bg.lineStyle(2, color, 1);
  bg.strokeRoundedRect(
    GAME_WIDTH / 2 - text.width / 2 - pad,
    40 - text.height / 2 - 10,
    text.width + pad * 2,
    text.height + 20,
    8,
  );
  const group = scene.add.container(0, -80, [bg, text]).setDepth(DEPTH.modal);
  scene.tweens.add({ targets: group, y: 0, duration: 200, ease: 'Back.Out' });
  scene.time.delayedCall(ms, () =>
    scene.tweens.add({ targets: group, alpha: 0, y: -40, duration: 250, onComplete: () => group.destroy() }),
  );
};
