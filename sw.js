// Service worker: red primero (datos siempre frescos), caché si no hay señal.
const CACHE = 'bitacora-reconstruccion-v1';
const BASE = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.json', 'icon.svg',
  'data/registros.json', 'data/cifras.json', 'data/noticias.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const clave = url.pathname.endsWith('.json') ? url.origin + url.pathname : e.request;
  e.respondWith(
    fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(clave, copia)); return r; })
      .catch(() => caches.match(clave).then(r => r || caches.match('index.html')))
  );
});
