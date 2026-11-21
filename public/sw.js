/* Service worker viết tay (Serwist/@serwist/next dựa trên webpack, không hợp build Turbopack của Next 16).
 * - Precache: icon + manifest (vỏ app).
 * - /_next/static, font và ảnh động /gifs/: StaleWhileRevalidate (mở lại app là có ngay, bản mới tải ngầm).
 * - Trang (navigate): NetworkFirst, timeout 3s rồi dùng bản cache.
 * - Ô bản đồ OpenStreetMap: CacheFirst, giữ tối đa MAX_TILES ô (vùng đã xem vẫn hiện khi mất sóng).
 * - Trang chưa từng mở lúc offline: trả trang /offline đã lưu sẵn.
 * - /api/* và mọi request không phải GET: không bao giờ cache. */
const VERSION = 'v3';
const SHELL = `ft-shell-${VERSION}`;
const STATIC = `ft-static-${VERSION}`;
const PAGES = `ft-pages-${VERSION}`;
const TILES = `ft-tiles-${VERSION}`;
const MAX_TILES = 400;
const OFFLINE_URL = '/offline';
const NETWORK_TIMEOUT_MS = 3000;
// loading.gif: màn chờ cần có ngay ở mọi lần mở app, kể cả khi mạng chậm.
const PRECACHE = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/gifs/loading.gif', OFFLINE_URL];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL, STATIC, PAGES, TILES];
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
    const hit = await cache.match(request);
    if (hit) return hit;
    // Mạng lỗi hẳn (không chỉ chậm) và chưa có bản lưu: trang offline thay vì màn lỗi của trình duyệt.
    return network.catch(async () => (await caches.match(OFFLINE_URL)) || Response.error());
  }
}

/** Ô bản đồ ít đổi: dùng bản lưu trước, xóa ô cũ nhất khi vượt MAX_TILES để không đầy bộ nhớ. */
async function tileCacheFirst(request) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k)));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (/(^|.)tile.openstreetmap.org$/.test(url.hostname)) {
    event.respondWith(tileCacheFirst(request));
    return;
  }
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
