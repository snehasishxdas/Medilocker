/**
 * MediLocker Service Worker (Offline PWA & Edge Cache v2.0)
 * - Stale-While-Revalidate for UI shell and static assets (0ms page transitions)
 * - Network-only with IndexedDB fallback for live APIs
 */

const CACHE_NAME = 'medilocker-vault-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[MediLocker SW] Pre-cache notice:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API calls from service worker cache (API handled by ApiClient SWR & IndexedDB)
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return;
  }

  // Stale-While-Revalidate strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation
          if (event.request.destination === 'document') {
            return caches.match('/index.html') || caches.match('/');
          }
        });

      // Return cached response immediately if available, otherwise await network fetch
      return cachedResponse || fetchPromise;
    })
  );
});

