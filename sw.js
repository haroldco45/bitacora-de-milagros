// Bitácora de Milagros — service worker
// Datos y página: primero la red (siempre lo más nuevo), caché solo si no hay señal.
const VERSION = 'milagros-v2';
const BASICOS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // noticias en vivo: directo a la red
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      const clave = url.pathname.includes('/data/') ? url.origin + url.pathname : e.request;
      caches.open(VERSION).then(c => c.put(clave, copia));
      return r;
    }).catch(() => caches.match(url.pathname.includes('/data/') ? url.origin + url.pathname : e.request, { ignoreSearch: true }))
  );
});
