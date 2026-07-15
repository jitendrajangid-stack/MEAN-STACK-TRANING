/* Minimal service worker — enables PWA install + basic offline shell.
   Bump CACHE when you change index.html to refresh cached copies. */
var CACHE = 'mean-training-v1';
var ASSETS = ['.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // Never cache the Apps Script API — always hit the network for live data.
  if (url.hostname.indexOf('script.google') !== -1) return;
  if (e.request.method !== 'GET') return;
  // Network-first for the page so updates show; fall back to cache offline.
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
      return res;
    }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); })
  );
});
