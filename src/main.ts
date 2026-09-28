import { Game } from './core/Game';
import { isLocalHost } from './util/env';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app container element');
}

const game = new Game(container);
game.start();

// Live console/browser-automation debugging only — never in a real deployment.
if (isLocalHost()) {
  (window as unknown as { __game: Game }).__game = game;
}
