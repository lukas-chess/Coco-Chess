import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Alle Dateien unterhalb von dir, relativ und mit "/" als Trenner. */
export function listFiles(dir, base = dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listFiles(p, base));
    else if (e.name !== '.gitkeep') out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Versionsnummer = Hash über alle Dateinamen und -inhalte. Ändert sich etwas, wird neu gecacht. */
export function computeVersion(dir, files) {
  const hash = crypto.createHash('sha1');
  for (const f of files) {
    hash.update(f);
    hash.update(fs.readFileSync(path.join(dir, f)));
  }
  return hash.digest('hex').slice(0, 12);
}

export function buildServiceWorker({ template, files, version }) {
  if (!template.includes('__VERSION__') || !template.includes('__PRECACHE__')) {
    throw new Error('sw.template.js enthält die Platzhalter __VERSION__/__PRECACHE__ nicht.');
  }
  const list = ['./', ...files];
  return template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(list));
}
