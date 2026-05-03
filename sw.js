/* ══════════════════════════════════════════════════
   SERVICE WORKER — Quiz Révision Bac Djibouti 2026
   Version : v21
   Stratégie : Cache-First + mise à jour silencieuse en arrière-plan
   ══════════════════════════════════════════════════ */

const CACHE_NAME = 'quiz-bac-dj-v21';

/* Ressources locales à mettre en cache obligatoirement */
const LOCAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-144x144.png',
  './icon-152x152.png',
  './icon-167x167.png',
  './icon-180x180.png',
  './icon-192x192.png',
  './icon-256x256.png',
  './icon-384x384.png',
  './icon-512x512.png'
];

/* Polices Google Fonts — mises en cache en mode tentative (réseau optionnel) */
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap'
];

/* ─── INSTALLATION : mise en cache initiale ─── */
self.addEventListener('install', event => {
  console.log('[SW v21] Installation — mise en cache des ressources');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const localPromise = cache.addAll(LOCAL_URLS);
      const fontPromises = FONT_URLS.map(url =>
        fetch(url, { mode: 'no-cors' })
          .then(res => cache.put(url, res))
          .catch(() => console.warn('[SW] Police non mise en cache (hors ligne) :', url))
      );
      return Promise.all([localPromise, ...fontPromises]);
    }).then(() => {
      console.log('[SW v21] Installation réussie');
      return self.skipWaiting();
    })
  );
});

/* ─── ACTIVATION : suppression des anciens caches ─── */
self.addEventListener('activate', event => {
  console.log('[SW v21] Activation — nettoyage des anciens caches');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW v21] Activation réussie');
      return self.clients.claim();
    })
  );
});

/* ─── FETCH : Cache-First + mise à jour silencieuse ─── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Ignorer les requêtes non-GET */
  if (request.method !== 'GET') return;

  /* Toujours passer par le réseau pour l'API Anthropic (NUUR) */
  if (url.hostname === 'api.anthropic.com') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        /* Servir depuis le cache immédiatement */
        /* + mise à jour silencieuse en arrière-plan */
        fetch(request)
          .then(response => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }

      /* Pas en cache : aller chercher sur le réseau */
      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          /* Réseau indisponible ET pas en cache → fallback page principale */
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    })
  );
});

/* ─── MESSAGE : forcer la mise à jour depuis l'app ─── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Mise à jour forcée');
    self.skipWaiting();
  }
});
