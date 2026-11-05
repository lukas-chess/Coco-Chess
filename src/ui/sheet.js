import { h } from './dom.js';

/** Bottom-Sheet. `body` ist ein Element oder eine Funktion (close) => Element. Gibt ein Promise mit dem close-Wert zurück. */
export function openSheet({ title, body, dismissible = true }) {
  return new Promise((resolve) => {
    let backdrop;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) close(null);
    };
    function close(value = null) {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 180);
      resolve(value);
    }
    const content = typeof body === 'function' ? body(close) : body;
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'sheet-grab' }), h('h2', { class: 'sheet-title' }, title), content);
    backdrop = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === backdrop && dismissible) close(null); } }, sheet);
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
  });
}

export function confirmSheet({ title, text, confirm = 'OK', danger = false }) {
  return openSheet({
    title,
    body: (close) =>
      h('div', { style: 'display:grid;gap:12px' },
        h('p', { class: 'muted' }, text),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' btn-block', type: 'button', onclick: () => close(true) }, confirm),
        h('button', { class: 'btn btn-block', type: 'button', onclick: () => close(false) }, 'Abbrechen')),
  }).then((v) => v === true);
}

export function promotionSheet() {
  const opts = [['q', '♕', 'Dame'], ['r', '♖', 'Turm'], ['b', '♗', 'Läufer'], ['n', '♘', 'Springer']];
  return openSheet({
    title: 'Bauernumwandlung',
    body: (close) =>
      h('div', { style: 'display:grid;gap:12px' },
        h('p', { class: 'muted' }, 'In welche Figur wird der Bauer umgewandelt?'),
        h('div', { class: 'promo' }, opts.map(([v, glyph, name]) =>
          h('button', { class: 'btn', type: 'button', onclick: () => close(v) }, h('span', {}, glyph), name))),
        h('button', { class: 'btn btn-block', type: 'button', onclick: () => close(null) }, 'Abbrechen')),
  });
}
