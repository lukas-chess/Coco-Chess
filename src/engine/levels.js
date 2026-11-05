/**
 * Die zehn Schwierigkeitsstufen.
 *
 * Jede Stufe kombiniert mehrere Stockfish-Einstellungen, damit die Stärke nicht
 * nur vom Zufall abhängt:
 *  - Stufen 1–4: "Skill Level" (0–20) plus feste Suchtiefe und kurze Bedenkzeit.
 *  - Stufen 5–9: "UCI_LimitStrength" + "UCI_Elo" (Stockfish-Minimum ist 1320) plus Bedenkzeit.
 *  - Stufe 10: volle Stärke (Skill Level 20, keine Begrenzung), längere Bedenkzeit.
 *
 * Die Elo-Werte sind Engine-Einstellungen, KEINE gemessenen Spielstärken
 * (die Engine ist eine "Lite"-Variante und die Bedenkzeit ist kurz).
 */
export const LEVELS = [
  { id: 1, name: 'Anfänger', skill: 0, depth: 1, movetime: 60 },
  { id: 2, name: 'Sehr leicht', skill: 3, depth: 2, movetime: 100 },
  { id: 3, name: 'Leicht', skill: 6, depth: 3, movetime: 150 },
  { id: 4, name: 'Normal', skill: 9, depth: 5, movetime: 250 },
  { id: 5, name: 'Mittel', elo: 1400, movetime: 400 },
  { id: 6, name: 'Fortgeschritten', elo: 1650, movetime: 600 },
  { id: 7, name: 'Schwer', elo: 1950, movetime: 800 },
  { id: 8, name: 'Sehr schwer', elo: 2300, movetime: 1200 },
  { id: 9, name: 'Experte', elo: 2750, movetime: 1800 },
  { id: 10, name: 'Maximale Stärke', skill: 20, movetime: 3000 },
];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = LEVELS.length;

export function clampLevel(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 4;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, v));
}

export function getLevel(id) {
  return LEVELS[clampLevel(id) - 1];
}

/**
 * Adaptiver Modus: Sieg -> eine Stufe härter, Niederlage -> eine Stufe leichter,
 * Remis -> unverändert.
 */
export function nextLevel(current, outcome) {
  if (outcome === 'win') return clampLevel(current + 1);
  if (outcome === 'loss') return clampLevel(current - 1);
  return clampLevel(current);
}
