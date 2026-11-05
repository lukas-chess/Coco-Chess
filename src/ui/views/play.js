import { h, segmented } from '../dom.js';
import { FILES, RANKS, parseMoveText, fmtMove, COLOR_NAMES } from '../../chess/notation.js';
import { heroModel } from '../hero.js';
import { promotionSheet } from '../sheet.js';

const sq = (p) => (p.f && p.r ? p.f + p.r : null);
const emptyPart = () => ({ f: null, r: null });

export function createPlayView({ controller, settings }) {
  const pick = { from: emptyPart(), to: emptyPart(), active: 'from', targets: null };
  let locked = false;
  let lastLen = -1;
  let lastTone = '';

  /* Computerzug-Karte */
  const heroLabel = h('p', { class: 'hero-label' });
  const heroMove = h('div', { class: 'hero-move', 'aria-live': 'polite' });
  const heroSub = h('p', { class: 'hero-sub' });
  const heroHints = h('ul', { class: 'hero-hints' });
  const heroRetry = h('button', { class: 'btn btn-ghost hero-btn', type: 'button', onclick: () => controller.retryEngine() }, 'Erneut versuchen');
  const hero = h('section', { class: 'hero', 'aria-label': 'Computerzug' }, heroLabel, heroMove, heroSub, heroHints, heroRetry);

  /* Status */
  const turnVal = h('dd');
  const lastVal = h('dd');
  const status = h('dl', { class: 'card status' }, h('div', {}, h('dt', {}, 'Am Zug'), turnVal), h('div', {}, h('dt', {}, 'Letzter Zug'), lastVal));

  /* Eingabe: Feldauswahl */
  const mkSlot = (key, label) => {
    const val = h('span', { class: 'slot-val' }, '–');
    const el = h('button', { class: 'slot', type: 'button', onclick: () => { pick.active = key; renderPicker(); } }, h('span', { class: 'slot-label' }, label), val);
    return { el, val };
  };
  const slots = { from: mkSlot('from', 'Von'), to: mkSlot('to', 'Nach') };
  const fileKeys = FILES.split('').map((f) => h('button', { class: 'key', type: 'button', 'data-v': f, 'aria-label': `Linie ${f}`, onclick: () => setPart('f', f) }, f));
  const rankKeys = RANKS.split('').map((r) => h('button', { class: 'key', type: 'button', 'data-v': r, 'aria-label': `Reihe ${r}`, onclick: () => setPart('r', r) }, r));
  const playSquares = h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => submit({ from: sq(pick.from), to: sq(pick.to) }) }, 'Zug spielen');
  const squaresPanel = h('div', { style: 'display:grid;gap:10px' },
    h('div', { class: 'slots' }, slots.from.el, slots.to.el),
    h('div', { class: 'keys', role: 'group', 'aria-label': 'Linien a bis h' }, fileKeys),
    h('div', { class: 'keys', role: 'group', 'aria-label': 'Reihen 1 bis 8' }, rankKeys),
    playSquares);

  /* Eingabe: Text */
  const textInput = h('input', {
    class: 'text-input', type: 'text', inputmode: 'text', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    spellcheck: 'false', enterkeyhint: 'go', maxlength: '10', placeholder: 'e2e4', 'aria-label': 'Zug eingeben, zum Beispiel e2e4',
  });
  const playText = h('button', { class: 'btn btn-primary', type: 'button', onclick: submitText }, 'Spielen');
  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitText(); } });
  const textPanel = h('div', { style: 'display:grid;gap:8px' },
    h('div', { class: 'text-row' }, textInput, playText),
    h('p', { class: 'muted', style: 'margin:0' }, 'Von-Feld und Ziel-Feld, z. B. e2e4. Rochade als Königszug (e1g1), Umwandlung mit Buchstabe (e7e8q).'));

  const msg = h('p', { class: 'msg', 'aria-live': 'assertive' });
  const mode = segmented([{ v: 'squares', t: 'Felder wählen' }, { v: 'text', t: 'Text eingeben' }], settings.get().inputMethod, (v) => {
    settings.update({ inputMethod: v });
    showMode();
  });
  const inputCard = h('section', { class: 'card input-card', 'aria-label': 'Zugeingabe' }, mode.el, squaresPanel, textPanel, msg);

  /* Aktionen */
  const undoBtn = h('button', { class: 'btn', type: 'button', onclick: () => controller.undo().then((ok) => ok && setMsg('Zug zurückgenommen.', 'ok')) }, 'Zurück');
  const newBtn = h('button', { class: 'btn', type: 'button', onclick: () => el.dispatchEvent(new CustomEvent('open-new-game', { bubbles: true })) }, 'Neue Partie');
  const resignBtn = h('button', { class: 'btn', type: 'button', onclick: () => el.dispatchEvent(new CustomEvent('open-resign', { bubbles: true })) }, 'Aufgeben');
  const actions = h('div', { class: 'actions' }, undoBtn, newBtn, resignBtn);

  const el = h('section', { class: 'view', id: 'view-play' }, hero, status, inputCard, actions);

  function showMode() {
    const m = settings.get().inputMethod;
    squaresPanel.hidden = m !== 'squares';
    textPanel.hidden = m !== 'text';
    mode.set(m);
  }

  function setMsg(text, kind = '') {
    msg.textContent = text;
    msg.className = 'msg ' + kind;
    if (kind === 'error') {
      inputCard.classList.remove('shake');
      void inputCard.offsetWidth;
      inputCard.classList.add('shake');
    }
  }

  function resetPicker() {
    pick.from = emptyPart();
    pick.to = emptyPart();
    pick.active = 'from';
    pick.targets = null;
    renderPicker();
  }

  function isDim(kind, v) {
    if (pick.active !== 'to' || !pick.targets) return false;
    const p = pick.to;
    if (kind === 'f') return !pick.targets.some((t) => t[0] === v && (!p.r || t[1] === p.r));
    return !pick.targets.some((t) => t[1] === v && (!p.f || t[0] === p.f));
  }

  function renderPicker() {
    for (const k of ['from', 'to']) {
      slots[k].val.textContent = (pick[k].f || '') + (pick[k].r || '') || '–';
      slots[k].el.classList.toggle('active', pick.active === k);
    }
    const p = pick[pick.active];
    fileKeys.forEach((k) => { k.classList.toggle('sel', p.f === k.dataset.v); k.classList.toggle('dim', isDim('f', k.dataset.v)); });
    rankKeys.forEach((k) => { k.classList.toggle('sel', p.r === k.dataset.v); k.classList.toggle('dim', isDim('r', k.dataset.v)); });
    playSquares.disabled = !(sq(pick.from) && sq(pick.to));
  }

  function setPart(kind, v) {
    setMsg('');
    pick[pick.active][kind] = v;
    if (pick.active === 'from') {
      pick.targets = null;
      pick.to = emptyPart();
      const from = sq(pick.from);
      if (from) {
        const r = controller.targetsFrom(from);
        if (!r.ok) setMsg(r.error, 'error');
        else { pick.targets = r.targets; pick.active = 'to'; }
      }
    }
    renderPicker();
  }

  async function submit(input) {
    let res = controller.playerMove(input);
    if (!res.ok && res.needsPromotion) {
      const choice = await promotionSheet();
      if (!choice) return setMsg('Umwandlung abgebrochen – der Zug wurde nicht gespielt.', 'warn');
      res = controller.playerMove({ ...input, promotion: choice });
    }
    if (!res.ok) return setMsg(res.error, 'error');
    setMsg(`Zug ${fmtMove(res.move.from, res.move.to)} angenommen.`, 'ok');
    textInput.value = '';
    resetPicker();
  }

  function submitText() {
    const r = parseMoveText(textInput.value);
    if (!r.ok) return setMsg(r.error, 'error');
    submit({ from: r.from, to: r.to, promotion: r.promotion });
  }

  function render(s) {
    const m = heroModel(s);
    hero.className = 'hero hero--' + m.tone;
    heroLabel.textContent = m.label;
    heroMove.replaceChildren(m.thinking ? h('span', { class: 'dots' }, 'Rechnet') : m.move);
    heroSub.textContent = m.sub;
    heroSub.hidden = !m.sub;
    heroHints.replaceChildren(...m.hints.map((t) => h('li', {}, t)));
    heroHints.hidden = !m.hints.length;
    heroRetry.hidden = !m.retry;
    if (m.tone === 'move' && (s.moves.length !== lastLen || lastTone !== 'move')) {
      hero.classList.remove('land');
      void hero.offsetWidth;
      hero.classList.add('land');
    }
    lastTone = m.tone;

    const last = s.moves[s.moves.length - 1];
    turnVal.replaceChildren(
      h('span', { class: 'turn-dot ' + s.turn }),
      s.over ? 'Beendet' : `${COLOR_NAMES[s.turn]} (${s.playerToMove ? 'du' : 'Computer'})`
    );
    lastVal.textContent = last ? `${last.color === s.playerColor ? 'Du' : 'Computer'}: ${fmtMove(last.from, last.to)}` : '–';

    locked = s.phase === 'thinking' || s.over || !s.playerToMove;
    squaresPanel.classList.toggle('locked', locked);
    textPanel.classList.toggle('locked', locked);
    undoBtn.disabled = !s.canUndo;
    resignBtn.disabled = s.over;
    if (s.moves.length !== lastLen) {
      if (lastLen !== -1) { resetPicker(); }
      lastLen = s.moves.length;
    }
  }

  showMode();
  renderPicker();
  return { el, render, setMsg };
}
