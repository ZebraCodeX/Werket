const CACHE_NAME = 'werket-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept API calls.
  if (url.pathname.startsWith('/api/')) return;

  // Same-origin only — don't touch cross-origin requests (fonts, etc.).
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations (HTML pages). Always serve fresh HTML and
  // fresh cookies so login/signup CSRF tokens never go stale after a deploy
  // (a cached page's hidden token no longer matches the browser's cookie).
  // The cache is only a fallback for offline use.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        return response;
      }).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
      )
    );
    return;
  }

  // Stale-while-revalidate for static assets (immutable, content-hashed).
  // Pages that carry Set-Cookie (auth responses) are never stored.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (
          response &&
          response.ok &&
          response.type === 'basic' &&
          !response.headers.has('set-cookie')
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      });
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});