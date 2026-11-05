import { kvGet, kvSet } from './db.js';
import { clampLevel } from '../engine/levels.js';

export const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  level: 4,
  adaptive: false,
  inputMethod: 'squares', // 'squares' | 'text'
  playerColor: 'w',
  stats: { win: 0, draw: 0, loss: 0 },
  recent: [],
  installTipDismissed: false,
};

export function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  s.level = clampLevel(s.level);
  if (!['system', 'light', 'dark'].includes(s.theme)) s.theme = 'system';
  if (!['squares', 'text'].includes(s.inputMethod)) s.inputMethod = 'squares';
  if (s.playerColor !== 'b') s.playerColor = 'w';
  s.adaptive = !!s.adaptive;
  s.stats = { ...DEFAULT_SETTINGS.stats, ...(s.stats || {}) };
  s.recent = Array.isArray(s.recent) ? s.recent.slice(-20) : [];
  return s;
}

/** Kleiner Store: get / update / subscribe. Speichert jede Änderung in IndexedDB. */
export async function createSettingsStore() {
  let state = normalizeSettings(await kvGet('settings'));
  const listeners = new Set();
  return {
    get: () => state,
    update(patch) {
      state = normalizeSettings({ ...state, ...patch });
      kvSet('settings', state);
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
