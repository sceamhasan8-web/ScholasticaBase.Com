/**
 * ScholasticBase Service Worker
 *
 * Key SPA fix: Navigation requests (page refreshes, direct URL visits) are
 * NEVER intercepted — they always go to the network so Vercel's rewrite rule
 * can serve index.html. Only static assets (JS, CSS, images, fonts) are cached.
 *
 * Without this, refreshing /admin would:
 *   1. SW intercepts the navigation fetch
 *   2. /admin isn't in cache → fetches from network
 *   3. If network returns 404 (old SW config), that 404 gets cached → stuck
 *
 * Now: navigation requests bypass SW entirely → Vercel serves index.html → React Router loads ✓
 */

const CACHE_NAME = 'scholasticbase-assets-v2';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/appicon.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // ✅ CRITICAL SPA FIX:
  // Never intercept HTML navigation requests (page load, refresh, direct URL).
  // Let them fall through to the network → Vercel rewrites them to index.html.
  // This is the #1 cause of SPA 404-on-refresh bugs with service workers.
  if (request.mode === 'navigate') {
    return; // Do NOT call event.respondWith() — network handles it
  }

  // Only cache GET requests for static assets
  if (request.method !== 'GET') return;

  // Only cache same-origin requests and known CDN assets (fonts, etc.)
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFont) return;

  // Cache-first strategy for static assets (JS, CSS, images, fonts)
  // Network-first for everything else on same origin
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    isGoogleFont;

  if (isStaticAsset) {
    // Cache-first: serve from cache, update cache in background
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only cache valid responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
  // All other same-origin requests (API calls, Firestore, etc.) go straight
  // to the network — no caching to avoid stale data issues
});
