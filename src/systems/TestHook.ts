import type Phaser from 'phaser';
import { E2E_HOOK } from '@/config/gameConfig';
import type { Side } from '@/characters/Character';
import type { BattleApi } from '@/scenes/BattleScene';
import { listTestTargets } from '@/ui/TestTargets';
import type { SaveData } from './SaveManager';
import type { Services } from './Services';

export interface FighterSnapshot {
  id: string;
  x: number;
  y: number;
  state: string;
  health: number;
  maxHealth: number;
  energy: number;
}

export interface TestHookApi {
  activeScenes(): string[];
  /** Clickable elements of active scenes, in game coordinates (1280×720). */
  targets(): Array<{ id: string; scene: string; x: number; y: number; enabled: boolean }>;
  battle(): {
    phase: string;
    frame: number;
    paused: boolean;
    mode: string;
    p1: FighterSnapshot;
    p2: FighterSnapshot;
    aiState: string | null;
  } | null;
  /** Frame data of one move of a fighter in the running battle (after specializations). */
  move(side: Side, moveId: string): { cooldown: number; energyCost: number; damage: number } | null;
  setHealth(side: Side, value: number): void;
  setEnergy(side: Side, value: number): void;
  setAIEnabled(enabled: boolean): void;
  save(): SaveData;
}

declare global {
  interface Window {
    __LF__?: TestHookApi;
  }
}

/**
 * Exposes read-mostly hooks for Playwright. Only compiled into `--mode e2e` builds; production
 * builds never install it. Tests still interact through real clicks and key presses.
 */
export const installTestHook = (game: Phaser.Game): void => {
  if (!E2E_HOOK) return;
  const services = (): Services => game.registry.get('services') as Services;
  const battleApi = (): BattleApi | undefined => game.registry.get('battle-api') as BattleApi | undefined;
  const snap = (api: BattleApi, side: Side): FighterSnapshot => {
    const f = api.match.fighter(side);
    return {
      id: f.data.id,
      x: f.x,
      y: f.y,
      state: f.state,
      health: f.health,
      maxHealth: f.maxHealth,
      energy: f.energy,
    };
  };
  window.__LF__ = {
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    targets: () => {
      const active = new Set(game.scene.getScenes(true).map((s) => s.scene.key));
      const out: ReturnType<TestHookApi['targets']> = [];
      for (const [id, { scene, target }] of listTestTargets(game)) {
        if (!active.has(scene) || !target.visible) continue;
        const b = target.getBounds();
        out.push({ id, scene, x: b.centerX, y: b.centerY, enabled: target.enabled });
      }
      return out;
    },
    battle: () => {
      const api = battleApi();
      if (!api) return null;
      return {
        phase: api.match.phase,
        frame: api.match.frame,
        paused: api.paused(),
        mode: api.data.mode,
        p1: snap(api, 'p1'),
        p2: snap(api, 'p2'),
        aiState: api.ai?.state ?? null,
      };
    },
    move: (side, moveId) => {
      const m = battleApi()
        ?.match.fighter(side)
        .data.moves.find((x) => x.id === moveId);
      return m ? { cooldown: m.cooldown, energyCost: m.energyCost, damage: m.hit?.damage ?? 0 } : null;
    },
    setHealth: (side, value) => {
      const api = battleApi();
      if (api) api.match.fighter(side).health = value;
    },
    setEnergy: (side, value) => {
      const api = battleApi();
      if (api) api.match.fighter(side).skills.energy = value;
    },
    setAIEnabled: (enabled) => {
      const api = battleApi();
      if (api?.ai) api.ai.enabled = enabled;
    },
    save: () => services().save.data,
  };
};
