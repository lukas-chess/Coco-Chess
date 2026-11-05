/* Coco Chess – Service Worker (wird beim Build mit Dateiliste befüllt) */
const VERSION = '__VERSION__';
const CACHE = 'coco-chess-' + VERSION;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Alles-oder-nichts: Schlägt eine Datei fehl (z. B. die Engine), wird dieser
      // Service Worker nicht aktiv und die App behauptet keine Offline-Fähigkeit.
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, self.registration.scope).href;
          const res = await fetch(url, { cache: 'reload' });
          if (!res.ok) throw new Error('Precache fehlgeschlagen: ' + url + ' (' + res.status + ')');
          await cache.put(url, res);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('coco-chess-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const index = await cache.match(new URL('./', self.registration.scope).href);
        if (index) return index;
      }
      try {
        return await fetch(req);
      } catch (e) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
