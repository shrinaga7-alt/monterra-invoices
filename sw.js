// Keeps the app working without internet. Shows the saved copy at once and quietly fetches updates for next time.
const CACHE = 'monterra-invoices-v5';
const FILES = ['./', 'index.html', 'app.js', 'logic.js', 'data.js', 'manifest.json', 'icon-180.png', 'icon-512.png',
  'vendor/html2canvas.min.js', 'vendor/jspdf.umd.min.js', 'vendor/qrcode.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'vendor/inter-latin.woff2', 'vendor/inter-latin-ext.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
