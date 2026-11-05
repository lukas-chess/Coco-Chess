/** Reine Hilfsfunktionen ohne chess.js-Abhängigkeit (leicht testbar). */

export const FILES = 'abcdefgh';
export const RANKS = '12345678';
export const PIECE_NAMES = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
export const COLOR_NAMES = { w: 'Weiß', b: 'Schwarz' };

export const fmtMove = (from, to) => `${from} → ${to}`;
export const toUci = (m) => m.from + m.to + (m.promotion || '');
export const fromUci = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
export const isUci = (u) => typeof u === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u);

/**
 * Liest eine Texteingabe wie "e2e4", "E2-E4", "e2 e4", "e7e8q" oder "e7e8=Q".
 * @returns {{ok:true, from:string, to:string, promotion?:string} | {ok:false, error:string}}
 */
export function parseMoveText(raw) {
  const original = String(raw ?? '').trim();
  const t = original.toLowerCase().replace(/[\s\-–—→x:=]/g, '');
  if (!t) return { ok: false, error: 'Bitte gib einen Zug ein, zum Beispiel e2e4.' };
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(t);
  if (!m) {
    if (/^[a-h][1-8]$/.test(t)) return { ok: false, error: 'Es fehlt das Zielfeld. Beispiel: e2e4 (von e2 nach e4).' };
    if (/^(0|o){2,3}$/.test(t)) {
      return { ok: false, error: 'Rochade gibst du als Königszug ein: Weiß e1g1 (kurz) oder e1c1 (lang), Schwarz e8g8 oder e8c8.' };
    }
    return { ok: false, error: `„${original}“ ist keine gültige Eingabe. Nutze zwei Felder wie e2e4 oder g1f3.` };
  }
  if (m[1] === m[2]) return { ok: false, error: 'Ausgangs- und Zielfeld sind gleich.' };
  return { ok: true, from: m[1], to: m[2], promotion: m[3] };
}

/**
 * Beschreibt einen Zug so, dass man ihn auf dem echten Brett nachspielen kann.
 * @param {{from,to,piece,color,captured?,promotion?,flags?,san?}} move
 */
export function describeMove(move) {
  const flags = move.flags || '';
  const hints = [];
  const rank = move.color === 'w' ? '1' : '8';
  if (flags.includes('k')) hints.push(`Rochade kurz: König ${move.from} → ${move.to}, Turm h${rank} → f${rank}.`);
  else if (flags.includes('q')) hints.push(`Rochade lang: König ${move.from} → ${move.to}, Turm a${rank} → d${rank}.`);
  if (flags.includes('e')) {
    hints.push(`En passant: Entferne den geschlagenen Bauern auf ${move.to[0]}${move.from[1]}.`);
  } else if (move.captured) {
    hints.push(`Schlägt ${PIECE_NAMES[move.captured]} auf ${move.to} – nimm sie vom Brett.`);
  }
  if (move.promotion) {
    hints.push(`Umwandlung: Der Bauer auf ${move.to} wird zu ${PIECE_NAMES[move.promotion]}.`);
  }
  const san = move.san || '';
  if (san.endsWith('#')) hints.push('Schachmatt!');
  else if (san.endsWith('+')) hints.push('Schach!');
  return { title: fmtMove(move.from, move.to), pieceName: PIECE_NAMES[move.piece] || '', hints };
}
