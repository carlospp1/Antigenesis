// Caché del dispositivo para lo que más pesa: modelos 3D (.glb), el mapa, las imágenes y las fuentes.
// La primera visita los descarga; las siguientes los sacan de aquí al momento (también sin conexión).
// En segundo plano se pregunta al servidor si han cambiado (petición condicional: si no han cambiado no se
// descarga nada) y, si hay versión nueva, se guarda para la próxima vez.
const CACHE = 'antigenesis-assets-v1';
const HEAVY = /\.(glb|gltf|webp|jpe?g|png|svg|woff2?|ttf)$/i;
const IMMUTABLE = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/; // archivos de la compilación (llevan huella en el nombre)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('antigenesis-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (url.origin !== location.origin && !fonts) return;
  if (IMMUTABLE.test(url.pathname) || fonts) { e.respondWith(cacheFirst(req)); return; }
  if (HEAVY.test(url.pathname)) { e.respondWith(cacheThenRevalidate(req, e)); return; }
  // la página y el resto: de la red, y si no hay conexión, lo último guardado
  if (req.mode === 'navigate') e.respondWith(networkFirst(req));
});

/** Archivos que nunca cambian: de la caché si están; si no, de la red y se guardan. */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/** Modelos e imágenes: de la caché al momento y, por detrás, se comprueba si hay versión nueva. */
async function cacheThenRevalidate(req, e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = (async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // condicional: si no ha cambiado no se descarga
      if (!res.ok) return res;
      const same = hit && hit.headers.get('etag') && hit.headers.get('etag') === res.headers.get('etag');
      if (!same) await cache.put(req, res.clone());
      return res;
    } catch (err) { if (!hit) throw err; }
  })();
  if (hit) { e.waitUntil(update); return hit; }
  return update;
}

/** La página: de la red (siempre la última versión del juego); sin conexión, la guardada. */
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}
