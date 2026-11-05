import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { listFiles, computeVersion, buildServiceWorker } from '../scripts/sw-builder.mjs';

const template = fs.readFileSync(new URL('../src/sw.template.js', import.meta.url), 'utf8');

test('Service Worker wird mit Dateiliste und Version befüllt und ist gültiges JavaScript', () => {
  const sw = buildServiceWorker({ template, files: ['index.html', 'engine/stockfish.js', 'engine/stockfish.wasm'], version: 'abc123' });
  assert.match(sw, /const VERSION = 'abc123'/);
  assert.match(sw, /"engine\/stockfish\.wasm"/);
  assert.match(sw, /"\.\/"/);
  assert.ok(!sw.includes('__PRECACHE__') && !sw.includes('__VERSION__'));
  assert.doesNotThrow(() => new vm.Script(sw));
});

test('Template ohne Platzhalter wird abgelehnt', () => {
  assert.throws(() => buildServiceWorker({ template: 'x', files: [], version: '1' }));
});

test('listFiles / computeVersion: Version ändert sich mit dem Inhalt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-'));
  fs.mkdirSync(path.join(dir, 'engine'));
  fs.writeFileSync(path.join(dir, 'index.html'), 'a');
  fs.writeFileSync(path.join(dir, 'engine', 'x.wasm'), 'w');
  const files = listFiles(dir);
  assert.deepEqual(files, ['engine/x.wasm', 'index.html']);
  const v1 = computeVersion(dir, files);
  assert.equal(v1, computeVersion(dir, files));
  fs.writeFileSync(path.join(dir, 'index.html'), 'b');
  assert.notEqual(v1, computeVersion(dir, files));
});

/** Prüft die Logik des Service Workers mit simulierten Browser-APIs. */
test('Service Worker: Offline liefert aus dem Cache, Navigation fällt auf index.html zurück', async () => {
  const store = new Map();
  const listeners = {};
  const cacheApi = {
    open: async () => ({
      put: async (url, res) => store.set(url, res),
      match: async (req) => {
        const url = typeof req === 'string' ? req : req.url;
        return store.get(url.split('?')[0]);
      },
    }),
    keys: async () => [],
    delete: async () => true,
  };
  const scope = 'https://example.github.io/coco-chess/';
  const sandbox = {
    URL, Response, Promise, Error,
    caches: cacheApi,
    fetch: async (url) => new Response('body:' + url, { status: 200 }),
    self: {
      registration: { scope },
      location: { origin: 'https://example.github.io' },
      addEventListener: (type, fn) => (listeners[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
  };
  const sw = buildServiceWorker({ template, files: ['index.html', 'engine/stockfish.wasm'], version: 't' });
  vm.runInNewContext(sw, sandbox);

  let installDone;
  listeners.install({ waitUntil: (p) => (installDone = p) });
  await installDone;
  assert.ok(store.has(scope + 'engine/stockfish.wasm'), 'Engine-Datei ist im Cache');
  assert.ok(store.has(scope), 'Startseite ist im Cache');

  // Ab jetzt "offline": Netzwerk wirft
  sandbox.fetch = async () => { throw new Error('offline'); };
  const respond = async (url, mode = 'no-cors') => {
    let p;
    listeners.fetch({ request: { method: 'GET', url, mode }, respondWith: (x) => (p = x) });
    return p;
  };
  const wasm = await respond(scope + 'engine/stockfish.wasm');
  assert.equal(wasm.status, 200);
  const nav = await respond(scope + 'irgendwas?x=1', 'navigate');
  assert.equal(nav.status, 200, 'Navigation -> App-Shell');
  const miss = await respond(scope + 'unbekannt.js');
  assert.equal(miss.status, 503);
});
