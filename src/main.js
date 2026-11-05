import './styles.css';
import { Engine } from './engine/stockfish.js';
import { createStockfishWorker } from './engine/worker-factory.js';
import { GameController } from './game/controller.js';
import { createSettingsStore } from './storage/settings.js';
import { loadGame, saveGame } from './storage/game-store.js';
import { requestPersistence } from './storage/db.js';
import { applyTheme, watchSystemTheme } from './ui/theme.js';
import { mountApp } from './ui/app.js';

async function boot() {
  const settings = await createSettingsStore();
  applyTheme(settings.get().theme);
  watchSystemTheme(() => settings.get().theme);

  const engine = new Engine({ createWorker: createStockfishWorker });
  const controller = new GameController({ engine, settings });
  const saved = await loadGame(); // zuerst laden, danach erst Speichern aktivieren

  mountApp({ root: document.getElementById('app'), controller, settings, engine });

  await controller.start(saved);
  controller.subscribe(() => saveGame(controller.serialize()));
  requestPersistence();

  // iOS kann Web Worker im Hintergrund beenden: beim Zurückkehren Engine prüfen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') controller.checkEngine();
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((e) => console.warn('Service Worker:', e));
  }
}

boot().catch((e) => {
  document.getElementById('app').textContent = 'Coco Chess konnte nicht gestartet werden: ' + (e && e.message ? e.message : e);
});
