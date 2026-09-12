const C = 'werket-v15';
const S = [
  '/',
  '/manifest.json',
  '/static/werket.css',
  '/static/fidel.js',
  '/static/werket.js',
  '/static/formats.js',
  '/static/icon.svg',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/icon-maskable-512.png',
  '/static/apple-touch-icon.png',
  '/static/template-blank.svg',
  '/static/template-letter.svg',
  '/static/template-journal.svg',
  '/static/template-meeting.svg',
  '/static/template-book.svg'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(S); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(C).then(function (c) { return c.put(e.request, copy); });
        return resp;
      });
    })
  );
});