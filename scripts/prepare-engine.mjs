/**
 * Kopiert die Stockfish-Dateien aus node_modules nach public/engine, damit sie
 * mit der App ausgeliefert und offline gecacht werden. Dateinamen werden NICHT
 * hart codiert, sondern gesucht (sie enthalten Versions-/Hash-Anteile).
 * Wir nehmen die Single-Thread-Variante ("single"), weil Multi-Thread
 * SharedArrayBuffer + spezielle HTTP-Header braucht (GitHub Pages kann das nicht).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'stockfish');
const outDir = path.join(root, 'public', 'engine');
const licDir = path.join(root, 'public', 'licenses');

const fail = (msg) => {
  console.error('\n[Coco Chess] FEHLER: ' + msg + '\n');
  process.exit(1);
};

function walk(dir, depth = 0) {
  if (depth > 3) return [];
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, depth + 1));
    else out.push(p);
  }
  return out;
}

if (!fs.existsSync(pkgDir)) fail('Das Paket "stockfish" fehlt. Bitte zuerst "npm install" ausführen.');

const files = walk(pkgDir);
const candidates = files
  .filter((f) => f.endsWith('.wasm') && /single/.test(path.basename(f)) && !/part-\d+/.test(f))
  .filter((f) => fs.existsSync(f.replace(/\.wasm$/, '.js')))
  .map((wasm) => {
    const n = path.basename(wasm);
    return { wasm, js: wasm.replace(/\.wasm$/, '.js'), score: (/lite/.test(n) ? 100 : 0) + (/nnue/.test(n) ? 1 : 0) };
  })
  .sort((a, b) => b.score - a.score);

if (!candidates.length) {
  fail(
    'Keine passende Single-Thread-Engine in node_modules/stockfish gefunden.\nGefundene Dateien:\n' +
      files.map((f) => '  ' + path.relative(pkgDir, f)).join('\n')
  );
}

const pick = candidates[0];
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f !== '.gitkeep') fs.rmSync(path.join(outDir, f));
fs.copyFileSync(pick.js, path.join(outDir, path.basename(pick.js)));
fs.copyFileSync(pick.wasm, path.join(outDir, path.basename(pick.wasm)));

const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
const meta = { js: path.basename(pick.js), wasm: path.basename(pick.wasm), version };
fs.writeFileSync(path.join(outDir, 'engine.json'), JSON.stringify(meta, null, 2));

// Lizenztexte der Bibliotheken ausliefern (GPL verlangt Lizenztext + Quellenhinweis)
fs.mkdirSync(licDir, { recursive: true });
function copyLicense(dir, name) {
  if (!fs.existsSync(dir)) return false;
  const lic = fs.readdirSync(dir).find((f) => /^(copying|license)/i.test(f));
  if (!lic) return false;
  fs.copyFileSync(path.join(dir, lic), path.join(licDir, name));
  return true;
}
if (!copyLicense(pkgDir, 'stockfish-license.txt')) console.warn('[Coco Chess] Warnung: Stockfish-Lizenztext nicht im Paket gefunden.');
if (!copyLicense(path.join(root, 'node_modules', 'chess.js'), 'chess.js-license.txt')) console.warn('[Coco Chess] Warnung: chess.js-Lizenztext nicht gefunden.');

const mb = (fs.statSync(pick.wasm).size / 1048576).toFixed(1);
console.log(`[Coco Chess] Engine bereit: ${meta.js} (+ .wasm, ${mb} MB), stockfish@${version}`);
