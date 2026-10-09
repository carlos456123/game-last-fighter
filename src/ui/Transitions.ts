import type Phaser from 'phaser';
import { TRANSITION_MS, type SceneKey } from '@/config/gameConfig';

/** Fast fade between scenes. Input is ignored during the fade so double clicks cannot stack. */
export const goTo = (scene: Phaser.Scene, key: SceneKey, data?: object): void => {
  if (scene.registry.get('transitioning') === true) return;
  scene.registry.set('transitioning', true);
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(TRANSITION_MS, 7, 6, 12);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.registry.set('transitioning', false);
    scene.scene.start(key, data);
  });
};

export const fadeIn = (scene: Phaser.Scene): void => {
  scene.registry.set('transitioning', false);
  scene.input.enabled = true;
  scene.cameras.main.fadeIn(TRANSITION_MS, 7, 6, 12);
};
