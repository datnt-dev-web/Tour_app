/* Service worker viết tay (Serwist/@serwist/next dựa trên webpack, không hợp build Turbopack của Next 16).
 * - Precache: icon + manifest (vỏ app).
 * - /_next/static, font và ảnh động /gifs/: StaleWhileRevalidate (mở lại app là có ngay, bản mới tải ngầm).
 * - Trang (navigate): NetworkFirst, timeout 3s rồi dùng bản cache.
 * - /api/* và mọi request không phải GET: không bao giờ cache. */
const VERSION = 'v2';
const SHELL = `ft-shell-${VERSION}`;
const STATIC = `ft-static-${VERSION}`;
const PAGES = `ft-pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 3000;
// loading.gif: màn chờ cần có ngay ở mọi lần mở app, kể cả khi mạng chậm.
const PRECACHE = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/gifs/loading.gif'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL, STATIC, PAGES];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fresh;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS));
  try {
    return await Promise.race([network, timeout]);
  } catch {
    return (await cache.match(request)) || network;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !/fonts\.(gstatic|googleapis)\.com$/.test(url.hostname)) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/gifs/') ||
    request.destination === 'font' ||
    /fonts\.(gstatic|googleapis)\.com$/.test(url.hostname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
