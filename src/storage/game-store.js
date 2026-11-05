import { kvGet, kvSet, kvDelete } from './db.js';

const KEY = 'game';

export async function loadGame() {
  const g = await kvGet(KEY);
  if (!g || g.v !== 1 || !Array.isArray(g.moves)) return null;
  return g;
}
let last = '';
export function saveGame(data) {
  const json = JSON.stringify(data);
  if (json === last) return;
  last = json;
  kvSet(KEY, data);
}
export function clearGame() {
  last = '';
  return kvDelete(KEY);
}
