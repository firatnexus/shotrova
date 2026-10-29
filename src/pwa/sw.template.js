/* Shotrova service worker — generated at build time from src/pwa/sw.template.js.
 *
 * Strategies:
 *  - App shell (hashed JS/CSS, icons, index.html): precached on install, cache-first.
 *  - Navigations: network-first with a 3 s timeout, falling back to cached index.html.
 *  - OCR engine + language data (/ocr/*): cache-first runtime cache, downloaded on
 *    first OCR or when the user taps "Prepare OCR for offline use".
 *  - Optional OCR language packs (/ocr-packs/*): never intercepted; the app
 *    verifies each download and keeps it in its own `-ocrpacks-v1` cache.
 *  - Web Share Target: POST /share-target is intercepted, shared files are put in a
 *    local Cache Storage inbox and the app is opened at #/import?shared=1.
 *  - Cross-origin requests are never intercepted.
 */
const VERSION = __VERSION__;
const PREFIX = __PREFIX__;
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const OCR_CACHE = `${PREFIX}-ocr-v1`;
const RUNTIME_CACHE = `${PREFIX}-runtime-v1`;
const INBOX_CACHE = `${PREFIX}-share-inbox`;
// Owned by the page (src/ocr/packs.ts); listed here only so updates never delete it.
const OCR_PACKS_CACHE = `${PREFIX}-ocrpacks-v1`;
const BASE = new URL('./', self.location.href).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE.map((p) => BASE + p).concat([BASE]));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, OCR_CACHE, RUNTIME_CACHE, INBOX_CACHE, OCR_PACKS_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('images').filter((f) => f && typeof f === 'object' && 'arrayBuffer' in f);
    const inbox = await caches.open(INBOX_CACHE);
    let i = 0;
    for (const file of files) {
      const key = `${BASE}__inbox__/${Date.now()}-${i++}`;
      await inbox.put(
        key,
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'shared-image'),
            'X-Last-Modified': String(file.lastModified || Date.now()),
          },
        }),
      );
    }
    return Response.redirect(`${BASE}#/import?shared=${files.length}`, 303);
  } catch (e) {
    return Response.redirect(`${BASE}#/import?shared=error`, 303);
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(BASE, response.clone());
    return response;
  } catch {
    return (await cache.match(BASE)) || (await cache.match(`${BASE}index.html`)) || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((r) => {
      if (r.ok) cache.put(request, r.clone());
      return r;
    })
    .catch(() => hit || new Response('', { status: 504 }));
  return hit || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === 'POST' && url.pathname === `${BASE}share-target`) {
    event.respondWith(handleShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith(`${BASE}__inbox__/`)) return;
  if (url.pathname.startsWith(`${BASE}ocr-packs/`)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith(`${BASE}ocr/`)) {
    event.respondWith(cacheFirst(request, OCR_CACHE));
    return;
  }
  const rel = url.pathname.slice(BASE.length);
  if (PRECACHE.includes(rel)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
