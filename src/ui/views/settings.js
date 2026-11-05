import { h, segmented } from '../dom.js';
import { createLevelPicker } from '../level.js';
import { applyTheme } from '../theme.js';
import { confirmSheet } from '../sheet.js';
import { kvDelete, storageState } from '../../storage/db.js';
import { readEngineMeta } from '../../engine/worker-factory.js';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export function createSettingsView({ settings, engine }) {
  const theme = segmented([{ v: 'system', t: 'System' }, { v: 'light', t: 'Hell' }, { v: 'dark', t: 'Dunkel' }], settings.get().theme, (v) => {
    settings.update({ theme: v });
    applyTheme(v);
  });

  const picker = createLevelPicker((lvl) => settings.update({ level: lvl }));
  const adaptive = h('input', { type: 'checkbox', id: 'adaptive', 'aria-label': 'Adaptiver Modus' });
  adaptive.addEventListener('change', () => settings.update({ adaptive: adaptive.checked }));
  const stats = h('div', { class: 'stat' });

  const offlineVal = h('span', { class: 'muted' }, 'wird geprüft …');
  const engineVal = h('span', { class: 'muted' }, '…');
  const storageVal = h('span', { class: 'muted' }, '…');
  const swVal = h('span', { class: 'muted' }, '…');

  const row = (label, val) => h('div', { class: 'row' }, h('span', {}, label), val);

  const wipe = h('button', { class: 'btn btn-danger btn-block', type: 'button', onclick: async () => {
    const ok = await confirmSheet({ title: 'Alle Daten löschen?', text: 'Gespeicherte Partie, Einstellungen und Bilanz werden von diesem Gerät entfernt.', confirm: 'Alles löschen', danger: true });
    if (!ok) return;
    await kvDelete('game');
    await kvDelete('settings');
    try { localStorage.removeItem('coco-theme'); } catch (e) { /* ignorieren */ }
    location.reload();
  } }, 'Alle Daten löschen');

  const installCard = h('section', { class: 'card' }, h('h2', {}, 'Auf dem Home-Bildschirm'),
    h('p', { class: 'muted' }, 'In Safari auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Danach startet Coco Chess wie eine normale App, auch ohne Internet.'));

  const el = h('section', { class: 'view', id: 'view-settings' },
    h('section', { class: 'card' }, h('h2', {}, 'Darstellung'), theme.el),
    h('section', { class: 'card' }, h('h2', {}, 'Schwierigkeit'), picker.el,
      h('div', { class: 'row' },
        h('label', { for: 'adaptive' }, h('b', {}, 'Adaptiver Modus'), h('div', { class: 'muted' }, 'Nach jeder Partie: Sieg → eine Stufe härter, Niederlage → eine Stufe leichter, Remis → gleich.')),
        h('span', { class: 'switch' }, adaptive)),
      h('div', { class: 'row' }, h('span', {}, 'Bilanz'), stats)),
    installCard,
    h('section', { class: 'card' }, h('h2', {}, 'Status'),
      row('Engine', engineVal), row('Offline-Speicher', offlineVal), row('Service Worker', swVal), row('Lokale Speicherung', storageVal)),
    h('section', { class: 'card' }, h('h2', {}, 'Über Coco Chess'),
      h('p', { class: 'muted' }, 'Alle Berechnungen laufen lokal auf deinem Gerät. Es werden keine Züge oder Partien an einen Server gesendet.'),
      h('p', { class: 'muted' }, 'Schachengine: Stockfish (GPL-3.0), WebAssembly-Port stockfish.js von Chess.com/nmrugg. Regeln: chess.js (BSD-2-Clause).'),
      h('p', {}, h('a', { href: 'licenses/NOTICE.txt' }, 'Lizenzhinweise'), ' · ', h('a', { href: 'licenses/stockfish-license.txt' }, 'Stockfish-Lizenz (GPL-3.0)'), ' · ',
        h('a', { href: 'https://github.com/official-stockfish/Stockfish', rel: 'noopener' }, 'Stockfish-Quellcode'), ' · ',
        h('a', { href: 'https://github.com/nmrugg/stockfish.js', rel: 'noopener' }, 'stockfish.js'), ' · ',
        h('a', { href: 'https://github.com/jhlywa/chess.js', rel: 'noopener' }, 'chess.js'))),
    wipe);

  async function checkStatus() {
    const meta = await readEngineMeta();
    const state = engine.status === 'ready' ? 'läuft' : engine.status === 'error' ? 'Fehler' : 'lädt';
    engineVal.textContent = meta ? `${engine.name || 'Stockfish'} (Paket ${meta.version}), ${state}` : 'Engine-Dateien nicht gefunden';
    try {
      if (!('caches' in window) || !meta) throw new Error('kein Cache');
      const hit = await caches.match(new URL('engine/' + meta.wasm, document.baseURI));
      offlineVal.textContent = hit ? 'Engine gespeichert ✓' : 'Noch nicht gespeichert';
    } catch (e) {
      offlineVal.textContent = 'nicht verfügbar';
    }
    swVal.textContent = 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'aktiv ✓' : 'noch nicht aktiv') : 'nicht unterstützt';
    storageVal.textContent = storageState.persistent ? 'IndexedDB ✓' : 'nur Arbeitsspeicher (Partie geht beim Schließen verloren)';
  }

  function render() {
    const s = settings.get();
    theme.set(s.theme);
    picker.update(s.level);
    adaptive.checked = s.adaptive;
    stats.replaceChildren(h('span', {}, `${s.stats.win} Siege`), h('span', {}, `${s.stats.draw} Remis`), h('span', {}, `${s.stats.loss} Niederlagen`));
    installCard.hidden = isStandalone() || !isIos();
  }
  return { el, render, checkStatus };
}
