/** Erzeugt den Stockfish-Worker. Dateinamen stehen in engine/engine.json (vom Build erzeugt). */
export async function createStockfishWorker() {
  if (typeof WebAssembly !== 'object') throw new Error('Dieser Browser unterstützt WebAssembly nicht.');
  const base = document.baseURI;
  const res = await fetch(new URL('engine/engine.json', base));
  if (!res.ok) throw new Error('engine/engine.json fehlt (Build ohne Engine-Dateien?).');
  const meta = await res.json();
  return new Worker(new URL('engine/' + meta.js, base));
}

export async function readEngineMeta() {
  try {
    const res = await fetch(new URL('engine/engine.json', document.baseURI));
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}
