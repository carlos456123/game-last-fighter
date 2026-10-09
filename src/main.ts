import '@fontsource/russo-one/400.css';
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/700.css';
import './styles.css';
import Phaser from 'phaser';
import { createGameConfig } from './config/phaserConfig';
import { Logger } from './utils/Logger';

/** Shows a readable error screen instead of failing silently. */
const showFatal = (message: string): void => {
  const overlay = document.getElementById('fatal-overlay');
  const text = document.getElementById('fatal-message');
  if (!overlay || !text) return;
  text.textContent = message;
  overlay.hidden = false;
  document
    .getElementById('fatal-reload')
    ?.addEventListener('click', () => window.location.reload(), { once: true });
};

window.addEventListener('error', (e) => Logger.error('Runtime', e.message, e.error));
window.addEventListener('unhandledrejection', (e) =>
  Logger.error('Runtime', 'Unhandled promise rejection', e.reason),
);

declare global {
  interface Window {
    __LF_GAME__?: Phaser.Game;
  }
}

try {
  const game = new Phaser.Game(createGameConfig('game'));
  // Dev builds expose the game instance for debugging from the console.
  if (import.meta.env.DEV) window.__LF_GAME__ = game;
} catch (err) {
  Logger.error('Boot', 'Failed to start the game', err);
  showFatal('Não foi possível iniciar o jogo. Verifique se o navegador suporta WebGL e recarregue a página.');
}
