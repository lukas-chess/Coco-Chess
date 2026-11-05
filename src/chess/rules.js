/**
 * Dünne Schicht um chess.js. Die gesamte Regelkenntnis (Rochade, en passant,
 * Umwandlung, Matt, Patt, Remis, Wiederholung, 50-Züge) kommt aus chess.js.
 */
import { Chess } from 'chess.js';
import { PIECE_NAMES, COLOR_NAMES } from './notation.js';

export { Chess };
const opposite = (c) => (c === 'w' ? 'b' : 'w');
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

/** Versucht einen Zug zu spielen. Verändert `chess` nur bei Erfolg. */
export function tryMove(chess, { from, to, promotion }) {
  const turn = chess.turn();
  const piece = chess.get(from);
  if (!piece) return fail(`Auf ${from} steht keine Figur. Prüfe das Ausgangsfeld.`);
  if (piece.color !== turn) {
    return fail(`Auf ${from} steht eine ${piece.color === 'w' ? 'weiße' : 'schwarze'} Figur, aber ${COLOR_NAMES[turn]} ist am Zug.`);
  }
  const name = PIECE_NAMES[piece.type];
  const inCheck = chess.inCheck();
  const legal = chess.moves({ square: from, verbose: true });
  if (!legal.length) {
    return fail(`Die Figur auf ${from} (${name}) kann gerade nicht ziehen.` + (inCheck ? ' Der König steht im Schach.' : ''));
  }
  const candidates = legal.filter((m) => m.to === to);
  if (!candidates.length) {
    return fail(
      `Die Figur auf ${from} (${name}) kann nicht nach ${to} ziehen.` +
        (inCheck ? ' Es ist Schach – der Zug muss das Schach beenden.' : '')
    );
  }
  if (candidates[0].promotion && !promotion) {
    return fail('Wähle eine Figur für die Umwandlung.', { needsPromotion: true });
  }
  const chosen = candidates.find((m) => (m.promotion || undefined) === (promotion || undefined));
  if (!chosen) return fail('Ungültige Umwandlung. Erlaubt sind Dame, Turm, Läufer und Springer.');
  try {
    const move = chess.move({ from, to, promotion: chosen.promotion });
    return { ok: true, move };
  } catch (e) {
    return fail('Ungültiger Zug: ' + (e && e.message ? e.message : 'unbekannter Fehler'));
  }
}

/** Zielfelder der Figur auf `from` (für den Spieler, der am Zug ist). */
export function targetsFrom(chess, from, playerColor) {
  const piece = chess.get(from);
  if (!piece) return fail(`Auf ${from} steht keine Figur.`);
  if (piece.color !== playerColor) return fail(`Auf ${from} steht eine gegnerische Figur.`);
  const targets = [...new Set(chess.moves({ square: from, verbose: true }).map((m) => m.to))];
  if (!targets.length) return fail(`Die Figur auf ${from} (${PIECE_NAMES[piece.type]}) kann gerade nicht ziehen.`);
  return { ok: true, targets };
}

/** Spielstatus. Reihenfolge der Remis-Gründe über Ausschluss, damit wir nur Basis-API von chess.js brauchen. */
export function gameStatus(chess, resigned = false, playerColor = 'w') {
  if (resigned) return { over: true, outcome: { kind: 'resigned', winner: opposite(playerColor) } };
  if (chess.isCheckmate()) return { over: true, outcome: { kind: 'checkmate', winner: opposite(chess.turn()) } };
  if (chess.isStalemate()) return { over: true, outcome: { kind: 'stalemate', winner: null } };
  if (chess.isInsufficientMaterial()) return { over: true, outcome: { kind: 'insufficient', winner: null } };
  if (chess.isThreefoldRepetition()) return { over: true, outcome: { kind: 'threefold', winner: null } };
  if (chess.isDraw()) return { over: true, outcome: { kind: 'fifty', winner: null } };
  return { over: false, outcome: null };
}

export function plainMove(m) {
  return { from: m.from, to: m.to, promotion: m.promotion, san: m.san, color: m.color, piece: m.piece, captured: m.captured, flags: m.flags };
}

/** Baut eine Partie aus einer UCI-Zugliste neu auf (Startstellung). Wirft bei ungültigen Zügen. */
export function replay(uciMoves, fromUciFn) {
  const chess = new Chess();
  for (const u of uciMoves) {
    const r = tryMove(chess, fromUciFn(u));
    if (!r.ok) throw new Error(`Ungültiger Zug in gespeicherter Partie: ${u}`);
  }
  return chess;
}
