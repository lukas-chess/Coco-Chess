const DARK_BAR = '#0e181c';
const LIGHT_BAR = '#6c4630';

export function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.getElementById('metaTheme');
  if (meta) meta.setAttribute('content', dark ? DARK_BAR : LIGHT_BAR);
  try {
    localStorage.setItem('coco-theme', pref); // nur Spiegel gegen Aufblitzen beim Start
  } catch (e) {
    /* ignorieren */
  }
}

export function watchSystemTheme(getPref) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getPref() === 'system') applyTheme('system');
  });
}
