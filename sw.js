/* Habit Studies service worker.
   Bump VERSION whenever you change any app file so phones pick up the update. */
const VERSION = 'hs-v1';
const FONT_CACHE = 'hs-fonts';
const META_CACHE = 'hs-meta';
const META_URL = './__hs_meta';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [VERSION, FONT_CACHE, META_CACHE];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: cache-first, navigations fall back to index.html (offline)
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});

/* ---------------------------------------------------------------- reminder */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function readMeta() {
  const res = await (await caches.open(META_CACHE)).match(META_URL);
  return res ? res.json() : {};
}
async function writeMeta(meta) {
  const cache = await caches.open(META_CACHE);
  await cache.put(META_URL, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}

async function maybeNotify() {
  const meta = await readMeta();
  const r = meta.reminder;
  if (!r || !r.enabled) return;
  if (self.Notification && Notification.permission !== 'granted') return;
  const now = new Date();
  const today = keyOf(now);
  if (meta.doneDay === today || meta.notifiedDay === today) return;
  const [h, m] = r.time.split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  await self.registration.showNotification('Bloque de estudio', {
    body: 'Todavía no registras nada hoy. Un bloque de 25 min mantiene la racha.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'hs-daily-reminder',
  });
  meta.notifiedDay = today;
  await writeMeta(meta);
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'skip-waiting') self.skipWaiting();
  else if (d.type === 'reminder-config') {
    e.waitUntil(readMeta().then((meta) => writeMeta({ ...meta, reminder: d.reminder, doneDay: d.doneDay })));
  } else if (d.type === 'check-reminder') {
    e.waitUntil(maybeNotify());
  }
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'hs-daily-reminder') e.waitUntil(maybeNotify());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  })());
});
