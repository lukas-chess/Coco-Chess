import test from 'node:test';
import assert from 'node:assert/strict';
import { fromUci } from '../src/chess/notation.js';

// Diese Tests brauchen chess.js (npm install). Ohne Paket werden sie ausdrücklich übersprungen.
let R = null;
try {
  R = await import('../src/chess/rules.js');
} catch (e) {
  R = null;
}
const skip = R ? false : 'chess.js ist nicht installiert (bitte "npm install" ausführen)';

const play = (chess, line) => {
  for (const u of line.split(' ')) {
    const r = R.tryMove(chess, fromUci(u));
    assert.ok(r.ok, `Zug ${u} sollte gültig sein: ${r.error}`);
  }
  return chess;
};

test('e2e4 als erster Zug', { skip }, () => {
  const c = new R.Chess();
  const r = R.tryMove(c, { from: 'e2', to: 'e4' });
  assert.ok(r.ok);
  assert.ok(c.fen().startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq'));
  assert.equal(c.turn(), 'b');
});

test('vollständige kurze Partie: Schäfermatt', { skip }, () => {
  const c = play(new R.Chess(), 'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7');
  const st = R.gameStatus(c);
  assert.equal(st.over, true);
  assert.deepEqual(st.outcome, { kind: 'checkmate', winner: 'w' });
});

test('Schachmatt für Schwarz (Narrenmatt)', { skip }, () => {
  const c = play(new R.Chess(), 'f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(R.gameStatus(c).outcome, { kind: 'checkmate', winner: 'b' });
});

test('Rochade kurz', { skip }, () => {
  const c = play(new R.Chess(), 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6');
  const r = R.tryMove(c, { from: 'e1', to: 'g1' });
  assert.ok(r.ok);
  assert.ok(r.move.flags.includes('k'));
  assert.equal(c.get('g1').type, 'k');
  assert.equal(c.get('f1').type, 'r');
});

test('Rochade lang', { skip }, () => {
  const c = play(new R.Chess(), 'd2d4 d7d5 b1c3 b8c6 c1f4 c8f5 d1d2 d8d7');
  const r = R.tryMove(c, { from: 'e1', to: 'c1' });
  assert.ok(r.ok);
  assert.ok(r.move.flags.includes('q'));
  assert.equal(c.get('d1').type, 'r');
});

test('En passant', { skip }, () => {
  const c = play(new R.Chess(), 'e2e4 a7a6 e4e5 d7d5');
  const r = R.tryMove(c, { from: 'e5', to: 'd6' });
  assert.ok(r.ok);
  assert.ok(r.move.flags.includes('e'));
  assert.ok(!c.get('d5'), 'geschlagener Bauer ist entfernt');
});

test('Bauernumwandlung verlangt eine Auswahl', { skip }, () => {
  const c = new R.Chess('7k/P7/8/8/8/8/8/K7 w - - 0 1');
  const first = R.tryMove(c, { from: 'a7', to: 'a8' });
  assert.equal(first.ok, false);
  assert.equal(first.needsPromotion, true);
  assert.equal(c.get('a7').type, 'p', 'Stellung blieb unverändert');
  const bad = R.tryMove(c, { from: 'a7', to: 'a8', promotion: 'k' });
  assert.equal(bad.ok, false);
  const ok = R.tryMove(c, { from: 'a7', to: 'a8', promotion: 'n' });
  assert.ok(ok.ok);
  assert.equal(c.get('a8').type, 'n');
});

test('Ungültige Züge liefern Meldungen und verändern nichts', { skip }, () => {
  const c = new R.Chess();
  const before = c.fen();
  for (const [mv, re] of [
    [{ from: 'e2', to: 'e5' }, /kann nicht nach e5 ziehen/],
    [{ from: 'e3', to: 'e4' }, /keine Figur/],
    [{ from: 'e7', to: 'e5' }, /Weiß ist am Zug/],
    [{ from: 'e1', to: 'e2' }, /kann gerade nicht ziehen/],
    [{ from: 'g1', to: 'g3' }, /kann nicht nach g3 ziehen/],
  ]) {
    const r = R.tryMove(c, mv);
    assert.equal(r.ok, false, JSON.stringify(mv));
    assert.match(r.error, re);
  }
  assert.equal(c.fen(), before);
});

test('Im Schach muss der Zug das Schach beenden', { skip }, () => {
  const c = play(new R.Chess(), 'e2e4 f7f6 d2d4 g7g5 d1h5');
  const r = R.tryMove(c, { from: 'a7', to: 'a6' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Schach/);
});

test('Patt', { skip }, () => {
  const c = new R.Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(R.gameStatus(c).outcome, { kind: 'stalemate', winner: null });
});

test('Remis: unzureichendes Material', { skip }, () => {
  const c = new R.Chess('k7/8/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(R.gameStatus(c).outcome.kind, 'insufficient');
});

test('Remis: dreifache Stellungswiederholung', { skip }, () => {
  const c = play(new R.Chess(), 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
  assert.equal(R.gameStatus(c).outcome.kind, 'threefold');
});

test('Remis: 50-Züge-Regel', { skip }, () => {
  const c = new R.Chess('8/8/8/4k3/8/8/4K3/7R w - - 100 80');
  assert.equal(R.gameStatus(c).outcome.kind, 'fifty');
});

test('Aufgabe zählt als Sieg des Gegners', { skip }, () => {
  assert.deepEqual(R.gameStatus(new R.Chess(), true, 'b').outcome, { kind: 'resigned', winner: 'w' });
});

test('Zurücknehmen stellt die Stellung wieder her', { skip }, () => {
  const c = new R.Chess();
  const start = c.fen();
  play(c, 'e2e4 e7e5');
  c.undo();
  c.undo();
  assert.equal(c.fen(), start);
});

test('replay baut Partie aus UCI-Liste; ungültige Liste wirft', { skip }, () => {
  const c = R.replay(['e2e4', 'e7e5', 'g1f3'], fromUci);
  assert.equal(c.history().length, 3);
  assert.throws(() => R.replay(['e2e4', 'e2e4'], fromUci));
});

test('targetsFrom: Zielfelder und Fehler', { skip }, () => {
  const c = new R.Chess();
  assert.deepEqual(R.targetsFrom(c, 'e2', 'w').targets.sort(), ['e3', 'e4']);
  assert.equal(R.targetsFrom(c, 'e1', 'w').ok, false);
  assert.equal(R.targetsFrom(c, 'e4', 'w').ok, false);
  assert.match(R.targetsFrom(c, 'd7', 'w').error, /gegnerische/);
});
