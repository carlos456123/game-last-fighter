import type Phaser from 'phaser';

/**
 * Registry of clickable UI elements by id. Used by the e2e test hook to locate real buttons on
 * the canvas (tests click them like a player would). Costs nothing in normal play.
 */
export interface TestTarget {
  x: number;
  y: number;
  visible: boolean;
  readonly enabled: boolean;
  getBounds(): Phaser.Geom.Rectangle;
}

const KEY = 'test-targets';

type TargetMap = Map<string, { scene: string; target: TestTarget }>;

const mapOf = (game: Phaser.Game): TargetMap => {
  let map = game.registry.get(KEY) as TargetMap | undefined;
  if (!map) {
    map = new Map();
    game.registry.set(KEY, map);
  }
  return map;
};

export const registerTestTarget = (scene: Phaser.Scene, id: string, target: TestTarget): void => {
  mapOf(scene.game).set(id, { scene: scene.scene.key, target });
};

export const unregisterTestTarget = (scene: Phaser.Scene, id: string): void => {
  const map = mapOf(scene.game);
  if (map.get(id)?.scene === scene.scene.key) map.delete(id);
};

export const listTestTargets = (game: Phaser.Game): TargetMap => mapOf(game);
