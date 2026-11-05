/** Minimaler IndexedDB-Key-Value-Speicher. Fällt bei Fehlern auf Arbeitsspeicher zurück. */
const DB_NAME = 'coco-chess';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();
export const storageState = { persistent: true, error: null };

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB ist nicht verfügbar.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB konnte nicht geöffnet werden.'));
      req.onblocked = () => reject(new Error('IndexedDB ist blockiert.'));
    }).catch((e) => {
      storageState.persistent = false;
      storageState.error = e.message;
      return null;
    });
  }
  return dbPromise;
}

function request(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
  });
}

export async function kvGet(key) {
  const db = await open();
  if (!db) return memory.get(key);
  try {
    return await request(db, 'readonly', (s) => s.get(key));
  } catch (e) {
    storageState.persistent = false;
    storageState.error = e.message;
    return memory.get(key);
  }
}

export async function kvSet(key, value) {
  memory.set(key, value);
  const db = await open();
  if (!db) return false;
  try {
    await request(db, 'readwrite', (s) => s.put(value, key));
    return true;
  } catch (e) {
    storageState.persistent = false;
    storageState.error = e.message;
    return false;
  }
}

export async function kvDelete(key) {
  memory.delete(key);
  const db = await open();
  if (!db) return;
  try {
    await request(db, 'readwrite', (s) => s.delete(key));
  } catch (e) {
    /* ignorieren */
  }
}

/** Bittet Safari, die Daten nicht automatisch zu löschen (kann abgelehnt werden). */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) {
    /* ignorieren */
  }
  return false;
}
