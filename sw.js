// Service worker for Ouk Chatrang: makes the game installable and playable
// offline. The app shell (this repo's own files) is precached at install;
// the CDN dependencies (three.js / OrbitControls / React from jsdelivr,
// Firebase from gstatic) are runtime-cached the first time they load, so
// after one online visit the whole game works with no connectivity.
// Everything else (Firebase auth/Firestore API traffic) passes straight
// through to the network untouched.
const CACHE = 'ouk-chatrang-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
// hosts that only ever serve immutable static assets for this app --
// safe to cache-first without risking stale API responses
const STATIC_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !STATIC_HOSTS.includes(url.hostname)) return; // API traffic: network only

  // the page itself is network-first so game updates land on the next
  // online visit, with the cached copy as the offline fallback
  const isPage = sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'));
  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // everything else (icons, CDN scripts): cache-first with background fill
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok || r.type === 'opaque') {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return r;
    }))
  );
});
