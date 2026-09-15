/* Service worker del Tablero Mindprint. La versión la inyecta el servidor (revisión de Cloud Run o arranque local):
   cada deploy cambia este archivo, el navegador lo detecta, instala el shell nuevo aparte y la app ofrece actualizar.
   El shell se sirve siempre desde la caché de SU versión (nunca se mezclan archivos de dos deploys);
   /api/estado va a la red y, si no hay, se devuelve la última foto marcada como offline. */
const VERSION = '__VERSION__';
const CACHE = `mindprint-${VERSION}`;
const FUENTES = 'mindprint-fuentes';
const SHELL = ['/', '/index.html', '/app.js', '/api.js', '/estado.js', '/ruta.js', '/cola.js', '/buscar.js', '/ui/base.js', '/ui/piezas.js', '/ui/ayuda.js',
  '/modulos/hoy.js', '/modulos/tareas.js', '/modulos/usuarios.js', '/modulos/oportunidades.js', '/modulos/chat.js', '/modulos/iteracion.js', '/modulos/actividad.js',
  '/estilos/tokens.css', '/estilos/base.css', '/estilos/shell.css', '/estilos/componentes.css', '/estilos/modulos.css',
  '/manifest.webmanifest', '/iconos/icono.svg', '/iconos/icono-192.png', '/iconos/icono-512.png'];

self.addEventListener('install', (e) => {
  // cache:'reload' salta la caché HTTP (max-age de 5 min): el shell que se guarda es el del deploy actual.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('mindprint-') && k !== CACHE && k !== FUENTES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data && e.data.tipo === 'activar') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(fuente(req));
    return;
  }
  const p = url.pathname;
  if (p === '/api/estado') { e.respondWith(estadoRedPrimero(req)); return; }
  if (p === '/salir') { e.respondWith(caches.open(CACHE).then((c) => c.delete('/api/estado')).then(() => fetch(req))); return; } // al salir no queda copia del estado
  if (p.startsWith('/api/') || p.startsWith('/entrar/') || p === '/sw.js' || p === '/version.json') return;
  if (req.mode === 'navigate') { e.respondWith(delShell('/index.html', req)); return; }
  if (SHELL.includes(p)) { e.respondWith(delShell(p, req)); return; }
});
async function delShell(clave, req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(clave);
  if (hit) return hit;
  return fetch(req);
}
async function estadoRedPrimero(req) {
  const c = await caches.open(CACHE);
  try { const r = await fetch(req); if (r.ok) c.put('/api/estado', r.clone()); return r; }
  catch (err) {
    const hit = await c.match('/api/estado'); if (!hit) throw err;
    const h = new Headers(hit.headers); h.set('X-Mindprint-Offline', '1');
    return new Response(hit.body, { status: 200, headers: h });
  }
}
async function fuente(req) {
  const c = await caches.open(FUENTES);
  const hit = await c.match(req); if (hit) return hit;
  try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }
  catch (err) { return Response.error(); }
}
