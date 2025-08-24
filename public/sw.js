// Enhanced service worker with browser extension protection
const CACHE_NAME = 'pull-up-club-v2'; // Increment version to force cache refresh
const STATIC_ASSETS = [
  // HTML shell deliberately excluded to always fetch latest version
  '/pullup_header_desktop.webp',
  '/pullup_header-tablet.webp',
  '/pullup_header-mobile.webp',
  '/PUClogo-optimized.webp',
  '/optimized-avatars/mike-johnson.svg',
  '/optimized-avatars/sarah-williams.svg',
  '/optimized-avatars/dave-rodriguez.svg'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing version', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((error) => console.log('SW: Install failed:', error))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating version', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Message event - handle client messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'CACHE_URLS':
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(event.data.payload))
            .catch((error) => console.log('SW: Cache URLs failed:', error))
        );
        break;
      default:
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ error: 'Unknown message type' });
        }
    }
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // CRITICAL: Skip browser extension requests and localhost protocol edge cases
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'moz-extension:' ||
    url.protocol === 'safari-extension:' ||
    url.protocol === 'chrome:' ||
    (url.hostname === 'localhost' && url.port === '')
  ) {
    return;
  }

  // Never cache index.html or the root route – always fetch from network
  if (
    event.request.url.includes('/index.html') ||
    event.request.url === new URL('/', self.location).href ||
    event.request.url.endsWith('/')
  ) {
    console.log('SW: Bypassing cache for HTML shell:', event.request.url);
    return;
  }

  // Skip API calls and external requests
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('stripe.com') ||
    event.request.url.includes('google-analytics.com') ||
    event.request.url.includes('sentry.io') ||
    event.request.url.includes('vercel.app')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log('SW: Cache hit for:', event.request.url);
        return response;
      }

      console.log('SW: Cache miss, fetching:', event.request.url);
      return fetch(event.request)
        .then((networkResponse) => {
          // Don't cache non-successful responses
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Skip caching for browser extension requests
          if (
            event.request.url.startsWith('chrome-extension:') ||
            event.request.url.startsWith('moz-extension:')
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();

          // Cache images and static assets
          if (event.request.url.match(/\.(jpg|jpeg|png|gif|webp|svg|css|js)$/)) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache))
              .catch((error) => console.log('SW: Cache put failed:', error));
          }

          return networkResponse;
        })
        .catch((error) => {
          console.log('SW: Fetch failed:', error);
          if (event.request.destination === 'document') {
            return new Response('Offline - Please check your connection', {
              status: 200,
              headers: { 'Content-Type': 'text/html' },
            });
          }
          return new Response('Network error occurred', { status: 408 });
        });
    })
  );
}); 