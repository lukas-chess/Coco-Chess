import { h, svg, segmented } from './dom.js';
import { levelMeter } from './level.js';
import { getLevel } from '../engine/levels.js';
import { openSheet, confirmSheet } from './sheet.js';
import { createPlayView } from './views/play.js';
import { createHistoryView } from './views/history.js';
import { createSettingsView, isStandalone } from './views/settings.js';
import { storageState } from '../storage/db.js';

const ICONS = {
  play: 'M5 4l14 8-14 8z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
};

export function mountApp({ root, controller, settings, engine }) {
  const play = createPlayView({ controller, settings });
  const history = createHistoryView({ controller });
  const prefs = createSettingsView({ settings, engine });

  const pillHost = h('button', { class: 'pill', type: 'button', 'aria-label': 'Schwierigkeit ändern', onclick: () => select('settings') });
  const topbar = h('header', { class: 'topbar' }, h('h1', { class: 'brand' }, 'Coco ', h('span', {}, 'Chess')), pillHost);

  const banner = h('div', { class: 'banner', hidden: true });
  const views = h('main', { class: 'views' }, play.el, history.el, prefs.el);
  play.el.prepend(banner);

  const tabs = [
    { id: 'play', label: 'Spiel', el: play.el },
    { id: 'history', label: 'Verlauf', el: history.el },
    { id: 'settings', label: 'Einstellungen', el: prefs.el },
  ];
  const tabButtons = tabs.map((t) => h('button', { class: 'tab', type: 'button', role: 'tab', onclick: () => select(t.id) }, svg(ICONS[t.id]), t.label));
  const tabbar = h('nav', { class: 'tabbar', role: 'tablist', 'aria-label': 'Hauptnavigation' }, tabButtons);

  function select(id) {
    tabs.forEach((t, i) => {
      t.el.hidden = t.id !== id;
      tabButtons[i].setAttribute('aria-selected', String(t.id === id));
    });
    views.scrollTop = 0;
    if (id === 'settings') prefs.checkStatus();
  }

  /* Hinweise (Speicher-Warnung, Installationstipp) */
  function renderBanner() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!storageState.persistent) {
      banner.replaceChildren(h('span', {}, 'Speichern auf diesem Gerät ist nicht möglich (z. B. privater Modus). Die Partie geht beim Schließen verloren.'));
      banner.hidden = false;
    } else if (ios && !isStandalone() && !settings.get().installTipDismissed) {
      banner.replaceChildren(
        h('span', {}, 'Tipp: Teilen → „Zum Home-Bildschirm“, dann läuft Coco Chess wie eine App und auch offline.'),
        h('button', { class: 'btn', type: 'button', style: 'min-height:36px;padding:0 12px', onclick: () => settings.update({ installTipDismissed: true }) }, 'OK'));
      banner.hidden = false;
    } else banner.hidden = true;
  }

  /* Partie-Dialoge */
  function openNewGame() {
    let color = settings.get().playerColor;
    openSheet({
      title: 'Neue Partie',
      body: (close) => {
        const seg = segmented([{ v: 'w', t: 'Ich spiele Weiß' }, { v: 'b', t: 'Ich spiele Schwarz' }], color, (v) => (color = v));
        const lvl = getLevel(settings.get().level);
        return h('div', { style: 'display:grid;gap:12px' },
          h('p', { class: 'muted' }, `Stufe ${lvl.id} (${lvl.name})${settings.get().adaptive ? ', adaptiver Modus ist an' : ''}. Die Stufe änderst du unter „Einstellungen“.`),
          seg.el,
          h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => { close(); controller.newGame(color); } }, 'Partie starten'),
          h('button', { class: 'btn btn-block', type: 'button', onclick: async () => {
            close();
            if (await confirmSheet({ title: 'Partie zurücksetzen?', text: 'Alle Züge der laufenden Partie werden gelöscht. Farbe und Stufe bleiben gleich.', confirm: 'Zurücksetzen', danger: true })) controller.resetGame();
          } }, 'Aktuelle Partie zurücksetzen'),
          h('button', { class: 'btn btn-block', type: 'button', onclick: () => close() }, 'Abbrechen'));
      },
    });
  }
  async function askResign() {
    if (await confirmSheet({ title: 'Aufgeben?', text: 'Die Partie zählt als Niederlage. Du kannst das mit „Zurück“ rückgängig machen.', confirm: 'Aufgeben', danger: true })) controller.resign();
  }
  views.addEventListener('open-new-game', openNewGame);
  views.addEventListener('open-resign', askResign);

  /* Rendern */
  function renderPill() {
    const l = getLevel(settings.get().level);
    pillHost.replaceChildren(h('span', { class: 'pill-num' }, String(l.id)), h('span', { class: 'pill-name' }, l.name), levelMeter(l.id));
  }
  controller.subscribe((s) => { play.render(s); history.render(s); });
  settings.subscribe(() => { renderPill(); prefs.render(); renderBanner(); });
  renderPill();
  prefs.render();
  renderBanner();
  play.render(controller.snapshot());
  history.render(controller.snapshot());

  root.replaceChildren(topbar, views, tabbar);
  select('play');
}
