import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevel, clampLevel, nextLevel } from '../src/engine/levels.js';
import { outcomeForPlayer } from '../src/chess/outcome.js';

test('es gibt genau zehn Stufen mit den geforderten Namen', () => {
  assert.deepEqual(
    LEVELS.map((l) => l.name),
    ['Anfänger', 'Sehr leicht', 'Leicht', 'Normal', 'Mittel', 'Fortgeschritten', 'Schwer', 'Sehr schwer', 'Experte', 'Maximale Stärke']
  );
  assert.deepEqual(LEVELS.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('Engine-Einstellungen steigen von Stufe zu Stufe (Stärke-Reihenfolge)', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    const a = LEVELS[i - 1], b = LEVELS[i];
    assert.ok(b.movetime > a.movetime, `Bedenkzeit steigt bei Stufe ${b.id}`);
  }
  const elo = LEVELS.filter((l) => l.elo).map((l) => l.elo);
  assert.deepEqual([...elo].sort((x, y) => x - y), elo, 'Elo-Werte sind aufsteigend');
  assert.ok(Math.min(...elo) >= 1320, 'UCI_Elo-Minimum von Stockfish (1320) wird eingehalten');
  const skills = LEVELS.slice(0, 4).map((l) => l.skill);
  assert.deepEqual([...skills].sort((x, y) => x - y), skills);
  assert.equal(LEVELS[9].skill, 20);
  assert.equal(LEVELS[9].elo, undefined, 'Stufe 10 ist unbegrenzt');
});

test('clampLevel / getLevel sind robust', () => {
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel(99), 10);
  assert.equal(clampLevel('abc'), 4);
  assert.equal(getLevel(5).name, 'Mittel');
});

test('adaptiver Modus: Sieg +1, Niederlage -1, Remis 0, mit Grenzen', () => {
  assert.equal(nextLevel(4, 'win'), 5);
  assert.equal(nextLevel(4, 'loss'), 3);
  assert.equal(nextLevel(4, 'draw'), 4);
  assert.equal(nextLevel(10, 'win'), 10);
  assert.equal(nextLevel(1, 'loss'), 1);
});

test('Ergebnis aus Spielersicht', () => {
  assert.equal(outcomeForPlayer({ kind: 'checkmate', winner: 'w' }, 'w'), 'win');
  assert.equal(outcomeForPlayer({ kind: 'checkmate', winner: 'w' }, 'b'), 'loss');
  assert.equal(outcomeForPlayer({ kind: 'stalemate', winner: null }, 'b'), 'draw');
  assert.equal(outcomeForPlayer({ kind: 'resigned', winner: 'b' }, 'w'), 'loss');
  assert.equal(outcomeForPlayer(null, 'w'), null);
});
