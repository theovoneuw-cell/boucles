// Cache d'abord, réseau ensuite : l'app marche sans connexion une fois ouverte.
// ⚠ Incrémenter CACHE à chaque modification, sinon les iPhone où l'app est
//   déjà installée continuent d'afficher l'ancienne version.
const CACHE = 'boucles-v2';
const ASSETS = [
  './', './index.html', './app.js', './data.js', './convert.js', './data-auto.json', './fonts.css', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  // Le catalogue automatique change chaque jour : réseau d'abord, cache si hors ligne.
  if (new URL(e.request.url).pathname.endsWith('/data-auto.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./data-auto.json', copy));
        return res;
      }).catch(() => caches.match('./data-auto.json'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
