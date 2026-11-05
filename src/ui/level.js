import { h } from './dom.js';
import { LEVELS, MAX_LEVEL, MIN_LEVEL, getLevel } from '../engine/levels.js';

/** Kleine Balkenanzeige der Stufe (für die Kopfzeile). */
export function levelMeter(level) {
  const el = h('span', { class: 'meter', 'aria-hidden': 'true' });
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const bar = h('i', { class: i <= level ? 'on' : '' });
    bar.style.height = 4 + i * 1 + 'px';
    el.append(bar);
  }
  return el;
}

/** Stufenwahl mit −/+ und tippbaren Balken. Gibt {el, update(level)} zurück. */
export function createLevelPicker(onChange) {
  const name = h('div', { class: 'lvl-name' });
  const bars = LEVELS.map((l) => {
    const b = h('button', { type: 'button', 'aria-label': `Stufe ${l.id}: ${l.name}`, onclick: () => onChange(l.id) });
    b.style.height = 10 + l.id * 2.4 + 'px';
    return b;
  });
  const cur = { v: 4 };
  const minus = h('button', { class: 'btn', type: 'button', 'aria-label': 'Eine Stufe leichter', onclick: () => onChange(cur.v - 1) }, '−');
  const plus = h('button', { class: 'btn', type: 'button', 'aria-label': 'Eine Stufe schwerer', onclick: () => onChange(cur.v + 1) }, '+');
  const el = h('div', { class: 'lvl' }, h('div', { class: 'lvl-head' }, minus, name, plus), h('div', { class: 'lvl-bars' }, bars));
  function update(level) {
    cur.v = level;
    const l = getLevel(level);
    name.replaceChildren(`Stufe ${l.id}`, h('small', {}, l.name));
    bars.forEach((b, i) => b.classList.toggle('on', i < level));
    minus.disabled = level <= MIN_LEVEL;
    plus.disabled = level >= MAX_LEVEL;
  }
  return { el, update };
}
