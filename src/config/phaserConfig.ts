import Phaser from 'phaser';
import { BattleScene } from '@/scenes/BattleScene';
import { BootScene } from '@/scenes/BootScene';
import { CharacterSelectScene } from '@/scenes/CharacterSelectScene';
import { CreditsScene } from '@/scenes/CreditsScene';
import { DialogScene } from '@/scenes/DialogScene';
import { ProgressionScene } from '@/scenes/ProgressionScene';
import { TournamentScene } from '@/scenes/TournamentScene';
import { DefeatScene } from '@/scenes/DefeatScene';
import { MenuScene } from '@/scenes/MenuScene';
import { PauseScene } from '@/scenes/PauseScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { TutorialScene } from '@/scenes/TutorialScene';
import { VictoryScene } from '@/scenes/VictoryScene';
import { COLORS, toCss } from '@/ui/theme';
import { FPS, GAME_HEIGHT, GAME_WIDTH } from './gameConfig';

/** Phaser engine configuration. Game-wide constants live in gameConfig.ts. */
export const createGameConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: toCss(COLORS.bg),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: { target: FPS },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  input: { activePointers: 4, keyboard: true, touch: true },
  disableContextMenu: true,
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    CharacterSelectScene,
    TutorialScene,
    BattleScene,
    PauseScene,
    VictoryScene,
    DefeatScene,
    SettingsScene,
    CreditsScene,
    TournamentScene,
    ProgressionScene,
    DialogScene,
  ],
});
