import { h, copyText } from '../dom.js';
import { fmtMove } from '../../chess/notation.js';

export function createHistoryView({ controller }) {
  const list = h('div', { class: 'moves' });
  const empty = h('p', { class: 'empty' }, 'Noch keine Züge. Sobald du ziehst, erscheint der Verlauf hier.');
  const fen = h('code', { class: 'fen' });
  const pgnBtn = h('button', { class: 'btn btn-block', type: 'button' }, 'Partie als PGN kopieren');
  const fenBtn = h('button', { class: 'btn', type: 'button' }, 'FEN kopieren');
  const flash = (btn, text) => { const t = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = t), 1600); };
  pgnBtn.addEventListener('click', async () => flash(pgnBtn, (await copyText(controller.pgn())) ? 'Kopiert ✓' : 'Kopieren nicht möglich'));
  fenBtn.addEventListener('click', async () => flash(fenBtn, (await copyText(controller.snapshot().fen)) ? 'Kopiert ✓' : 'Kopieren nicht möglich'));

  const el = h('section', { class: 'view', id: 'view-history' },
    h('div', { class: 'card' }, h('h2', {}, 'Partieverlauf'), empty, list),
    pgnBtn,
    h('details', { class: 'card' }, h('summary', {}, 'Technische Details (FEN)'),
      h('p', { class: 'muted' }, 'Die aktuelle Stellung in FEN-Notation. Wird intern zur Prüfung der Regeln verwendet.'), fen, fenBtn));

  function cell(m, s) {
    if (!m) return h('span');
    return h('div', { class: 'mv' + (m.color === s.playerColor ? ' mine' : '') }, h('b', {}, fmtMove(m.from, m.to)), h('small', {}, m.san));
  }

  function render(s) {
    empty.hidden = s.moves.length > 0;
    pgnBtn.hidden = s.moves.length === 0;
    const rows = [];
    for (let i = 0; i < s.moves.length; i += 2) {
      rows.push(h('span', { class: 'no' }, `${i / 2 + 1}.`), cell(s.moves[i], s), cell(s.moves[i + 1], s));
    }
    list.replaceChildren(...rows);
    fen.textContent = s.fen;
  }
  return { el, render };
}
