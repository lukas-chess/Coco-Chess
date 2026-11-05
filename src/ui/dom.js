/** Mini-Helfer zum Bauen von DOM-Elementen (ohne innerHTML, damit nie fremder Text als HTML gilt). */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function svg(path, size = 24) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}

/** Segmentierte Auswahl (z. B. Hell/Dunkel). */
export function segmented(options, value, onChange) {
  const buttons = options.map((o) =>
    h('button', { type: 'button', 'aria-pressed': String(o.v === value), onclick: () => { set(o.v); onChange(o.v); } }, o.t)
  );
  const el = h('div', { class: 'seg', role: 'group' }, buttons);
  function set(v) {
    options.forEach((o, i) => buttons[i].setAttribute('aria-pressed', String(o.v === v)));
  }
  return { el, set };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}
