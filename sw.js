/* ══════════════════════════════════════════════════
   SERVICE WORKER — Quiz Bac Djibouti 2026
   Stratégie : Cache-First avec mise à jour en arrière-plan
   ══════════════════════════════════════════════════ */

const CACHE_NAME = 'bac-dj-2026-v1';
const CACHE_URLS = [
  './',
  './quiz_bac_v3_pwa.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap'
];

/* ─── INSTALLATION : mise en cache initiale ─── */
self.addEventListener('install', event => {
  console.log('[SW] Installation — mise en cache des ressources essentielles');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On cache les ressources locales de façon fiable
      // Les polices Google Fonts sont tentatives (réseau optionnel)
      const localUrls = ['./', './quiz_bac_v3_pwa.html', './manifest.json'];
      const fontUrls = [
        'https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Montserrat:wght@300;400;500;600;700&display=swap',
        'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap'
      ];

      const localPromise = cache.addAll(localUrls);
      const fontPromises = fontUrls.map(url =>
        fetch(url, { mode: 'no-cors' })
          .then(res => cache.put(url, res))
          .catch(() => console.warn('[SW] Police non mise en cache (offline install) :', url))
      );

      return Promise.all([localPromise, ...fontPromises]);
    }).then(() => {
      console.log('[SW] Installation réussie');
      return self.skipWaiting();
    })
  );
});

/* ─── ACTIVATION : nettoyage anciens caches ─── */
self.addEventListener('activate', event => {
  console.log('[SW] Activation — nettoyage des anciens caches');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Suppression ancien cache :', key);
              return caches.delete(key);
            })
      )
    ).then(() => {
      console.log('[SW] Activation réussie — contrôle de tous les clients');
      return self.clients.claim();
    })
  );
});

/* ─── FETCH : stratégie Cache-First + fallback réseau ─── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions non supportées
  if (request.method !== 'GET') return;

  // Ignorer les requêtes vers l'API Anthropic (NUUR chatbot) — toujours réseau
  if (url.hostname === 'api.anthropic.com') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Ressource trouvée en cache — on la sert immédiatement
        // ET on lance une mise à jour silencieuse en arrière-plan
        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {}); // Pas de réseau = pas grave, on a le cache

        return cached;
      }

      // Pas en cache : tenter le réseau
      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200) return response;

          // Mettre en cache la nouvelle ressource
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // Réseau indisponible ET pas en cache
          // Retourner la page principale comme fallback
          if (request.destination === 'document') {
            return caches.match('./quiz_bac_v3_pwa.html');
          }
          // Pour les autres ressources, retourner une réponse vide
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
    console.log('[SW] Mise à jour forcée demandée');
    self.skipWaiting();
  }
});
