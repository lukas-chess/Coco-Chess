import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoveText, describeMove, toUci, fromUci, isUci } from '../src/chess/notation.js';

test('gültige Eingaben', () => {
  for (const [input, expected] of [
    ['e2e4', { from: 'e2', to: 'e4', promotion: undefined }],
    ['g1f3', { from: 'g1', to: 'f3', promotion: undefined }],
    ['b1c3', { from: 'b1', to: 'c3', promotion: undefined }],
    ['  E2-E4 ', { from: 'e2', to: 'e4', promotion: undefined }],
    ['e2 e4', { from: 'e2', to: 'e4', promotion: undefined }],
    ['e7e8q', { from: 'e7', to: 'e8', promotion: 'q' }],
    ['e7e8=N', { from: 'e7', to: 'e8', promotion: 'n' }],
  ]) {
    const r = parseMoveText(input);
    assert.equal(r.ok, true, input);
    assert.deepEqual({ from: r.from, to: r.to, promotion: r.promotion }, expected, input);
  }
});

test('ungültige Eingaben liefern verständliche Meldungen', () => {
  assert.match(parseMoveText('').error, /Bitte gib einen Zug ein/);
  assert.match(parseMoveText('e2').error, /Zielfeld/);
  assert.match(parseMoveText('0-0').error, /Rochade/);
  assert.match(parseMoveText('O-O-O').error, /Rochade/);
  assert.match(parseMoveText('e2e2').error, /gleich/);
  assert.match(parseMoveText('z9a1').error, /keine gültige Eingabe/);
  assert.match(parseMoveText('Sf3').error, /keine gültige Eingabe/);
  assert.equal(parseMoveText(null).ok, false);
});

test('UCI-Helfer', () => {
  assert.equal(toUci({ from: 'e7', to: 'e8', promotion: 'q' }), 'e7e8q');
  assert.deepEqual(fromUci('e2e4'), { from: 'e2', to: 'e4', promotion: undefined });
  assert.equal(fromUci('a7a8n').promotion, 'n');
  assert.ok(isUci('e2e4') && isUci('a7a8q'));
  assert.ok(!isUci('e2e9') && !isUci('') && !isUci(5));
});

test('Zugbeschreibung für das echte Brett', () => {
  const plain = describeMove({ from: 'e7', to: 'e5', piece: 'p', color: 'b', flags: 'b', san: 'e5' });
  assert.equal(plain.title, 'e7 → e5');
  assert.equal(plain.pieceName, 'Bauer');
  assert.deepEqual(plain.hints, []);

  const castleK = describeMove({ from: 'e8', to: 'g8', piece: 'k', color: 'b', flags: 'k', san: 'O-O' });
  assert.match(castleK.hints[0], /Rochade kurz.*Turm h8 → f8/);
  const castleQ = describeMove({ from: 'e1', to: 'c1', piece: 'k', color: 'w', flags: 'q', san: 'O-O-O' });
  assert.match(castleQ.hints[0], /Rochade lang.*Turm a1 → d1/);

  const ep = describeMove({ from: 'd4', to: 'e3', piece: 'p', color: 'b', captured: 'p', flags: 'e', san: 'dxe3' });
  assert.match(ep.hints[0], /En passant.*e4/);

  const cap = describeMove({ from: 'f3', to: 'e5', piece: 'n', color: 'w', captured: 'p', flags: 'c', san: 'Nxe5+' });
  assert.match(cap.hints[0], /Schlägt Bauer auf e5/);
  assert.ok(cap.hints.includes('Schach!'));

  const promo = describeMove({ from: 'a2', to: 'a1', piece: 'p', color: 'b', promotion: 'q', flags: 'p', san: 'a1=Q#' });
  assert.match(promo.hints[0], /wird zu Dame/);
  assert.ok(promo.hints.includes('Schachmatt!'));
});
