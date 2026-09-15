/* Capa de red: API del servidor, avisos en vivo (SSE) con sondeo de respaldo, escrituras optimistas con cola
   cuando no hay red. Emite por el bus: 'estado', 'sin-sesion', 'conexion', 'guardando', 'cola', 'error'. */
import { S, yo, lsSet } from './estado.js';
import { bus } from './ui/base.js';
import { crearCola, esErrorDeRed } from './cola.js';

let es = null;
export const cola = crearCola({ storage: (() => { try { return globalThis.localStorage || null; } catch { return null; } })() });

/** Límites de tiempo (ms). Una red que tira paquetes no rechaza la conexión: el navegador espera ~2 min antes de fallar.
    Sin límite, la app se quedaría en «guardando…» ese tiempo en vez de encolar. Se ajustan en pruebas. */
export const TIEMPOS = { lectura: 12000, escritura: 15000 };
const errorDeRed = (causa, timeout) => { const err = new Error('Sin conexión'); err.code = 'red'; err.timeout = !!timeout; err.causa = causa; return err; };

export async function api(metodo, ruta, cuerpo) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), metodo === 'GET' ? TIEMPOS.lectura : TIEMPOS.escritura) : null;
  try {
    let r;
    try { r = await fetch(ruta, { method: metodo, credentials: 'same-origin', headers: cuerpo ? { 'content-type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw errorDeRed(e, ctl && ctl.signal.aborted); }
    if (ruta === '/api/estado') S.fotoOffline = r.headers.get('x-mindprint-offline') === '1';
    if (r.status === 401) { sinSesion(); const e = new Error('sin_sesion'); e.code = 'sin_sesion'; throw e; }
    if (r.status === 304) return null;
    let j = null; try { j = await r.json(); } catch (e) { if (ctl && ctl.signal.aborted) throw errorDeRed(e, true); /* sin cuerpo */ }
    if (!r.ok) { const e = new Error((j && j.detalle) || (j && j.error) || `HTTP ${r.status}`); e.code = (j && j.error) || 'error'; e.status = r.status; throw e; }
    return j;
  } finally { if (timer) clearTimeout(timer); }
}

export function mensajeError(e) {
  if (e.code === 'sin_votos') return 'Ya usaste tus 3 votos. Quita uno de otra oportunidad para votar esta.';
  if (e.code === 'titulo_requerido') return 'Falta el título.';
  if (e.code === 'empresa_requerida') return 'Falta el nombre de la persona o empresa.';
  if (e.code === 'ajeno') return 'Solo quien escribió el mensaje puede borrarlo.';
  if (e.code === 'red') return 'Sin conexión. El cambio queda guardado aquí y se envía al volver la red.';
  if (e.status >= 500 || !e.status) return 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
  return e.message;
}

function sinSesion() { S.sinSesion = true; S.estado = null; S.yo = null; if (es) { es.close(); es = null; } bus.emit('sin-sesion'); }
function setConexion(c) { if (S.conexion !== c) { S.conexion = c; bus.emit('conexion', c); } }

export async function cargarEstado() {
  try {
    const j = await api('GET', '/api/estado');
    if (j) { S.estado = j; S.yo = j.yo; S.enLinea = j.enLinea || []; if (cola.largo) aplicarColaLocal(); }
    S.sinSesion = false;
    if (S.fotoOffline) setConexion('bad'); else if (S.conexion !== 'live') setConexion(es && es.readyState === 1 ? 'live' : 'poll');
    bus.emit('estado');
    if (cola.largo && !S.fotoOffline) vaciarCola();
  } catch (e) { if (e.code !== 'sin_sesion') { setConexion('bad'); bus.emit('estado'); } }
}

export function conectarSSE() {
  if (!('EventSource' in window)) { setConexion('poll'); return; }
  if (es) es.close();
  es = new EventSource('/api/eventos');
  es.addEventListener('hola', (ev) => { setConexion('live'); const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); else if (cola.largo) vaciarCola(); });
  es.addEventListener('cambio', (ev) => { const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); });
  es.addEventListener('presencia', (ev) => { S.enLinea = JSON.parse(ev.data).enLinea || []; bus.emit('presencia'); });
  es.onerror = () => { if (S.conexion === 'live') setConexion('poll'); };
}
export function sseAbierto() { return !!(es && es.readyState === 1); }
export function reconectar() { if (!es || es.readyState === 2) conectarSSE(); }

/* ---------- escrituras: optimistas, con cola si no hay red ---------- */
const ahora = () => new Date().toISOString();
const sinSellos = (d) => { const o = { ...d }; delete o.actualizado; delete o.actualizadoPor; delete o._pendiente; return o; };
const sello = (d) => ({ ...d, actualizado: ahora(), actualizadoPor: yo(), _pendiente: true });
function upsert(lista, doc) { const i = lista.findIndex((x) => x.id === doc.id); if (i >= 0) lista[i] = doc; else lista.push(doc); }
let vaciando = false;
export async function vaciarCola() {
  if (vaciando || !cola.largo) return;
  vaciando = true; bus.emit('cola');
  let descartadas = 0;
  try {
    const ok = await cola.vaciar(async (op) => { try { await api(op.metodo, op.ruta, op.cuerpo); return true; } catch (e) { if (esErrorDeRed(e)) return false; if (e.code === 'sin_sesion') throw e; descartadas++; return true; /* el servidor la rechazó: se descarta y el estado real manda */ } });
    if (ok || descartadas) await cargarEstado(); // si algo se descartó, el estado real reemplaza lo optimista aunque falte por enviar
  } catch (e) { if (e.code !== 'sin_sesion') console.error(e); }
  finally { vaciando = false; bus.emit('cola'); }
}
/** Vuelve a aplicar sobre el estado recién cargado lo que sigue en la cola (una foto vieja del service worker o una
    recarga sin red no deben «desaparecer» cambios que ya hizo la persona). */
export function aplicarColaLocal() {
  for (const op of cola.items) {
    const m = /^\/api\/(ideas|tareas|prospectos)\/([^/]+)$/.exec(op.ruta);
    if (m) { const col = m[1]; const id = decodeURIComponent(m[2]); if (!Array.isArray(S.estado[col])) S.estado[col] = []; if (op.metodo === 'DELETE') S.estado[col] = S.estado[col].filter((x) => x.id !== id); else upsert(S.estado[col], sello({ ...op.cuerpo, id })); continue; }
    if (op.ruta === '/api/iteracion' && op.cuerpo) { S.estado.iteracion = { ...op.cuerpo }; continue; }
    if (op.ruta === '/api/mensajes' && op.metodo === 'POST' && op.cuerpo) { S.estado.mensajes.push({ id: `pendiente-${op.clave}`, fecha: new Date(op.ts || Date.now()).toISOString(), quien: yo(), texto: op.cuerpo.texto, ref: op.cuerpo.ref ? { ...op.cuerpo.ref, titulo: '' } : null, _pendiente: true }); continue; }
    const d = /^\/api\/mensajes\/([^/]+)$/.exec(op.ruta); if (d && op.metodo === 'DELETE') S.estado.mensajes = S.estado.mensajes.filter((x) => x.id !== decodeURIComponent(d[1]));
  }
}
/** Ejecuta una escritura. Si no hay red: aplica `local()` y encola {metodo, ruta, cuerpo} para reintentar. */
async function escribir(args) {
  const { metodo, ruta, cuerpo, clave, alExito, local } = args;
  S.guardando++; bus.emit('guardando');
  try {
    const j = await api(metodo, ruta, cuerpo);
    alExito(j); S.ultimoGuardado = ahora(); bus.emit('estado'); return j && j.doc ? j.doc : true;
  } catch (e) {
    if (e.code === 'sin_sesion') return false;
    // Un POST que venció el tiempo pudo haber llegado: reenviarlo desde la cola duplicaría el mensaje. No se encola;
    // se recarga el estado (si llegó, aparece) y el texto vuelve a la caja para que la persona decida.
    if (esErrorDeRed(e) && e.timeout && metodo === 'POST') { setConexion('bad'); bus.emit('error', 'No se confirmó si el mensaje salió. Revisa el chat antes de reenviarlo.'); await cargarEstado(); return false; }
    if (esErrorDeRed(e)) { local(); cola.agregar({ clave, metodo, ruta, cuerpo }); setConexion('bad'); bus.emit('cola'); bus.emit('estado'); bus.emit('error', mensajeError(e)); return true; }
    // el servidor respondió con error: se avisa y el estado real manda; si fue del servidor (5xx) se ofrece reintentar
    bus.emit('error', e.status >= 500 ? { msg: mensajeError(e), reintentar: () => escribir(args) } : mensajeError(e)); await cargarEstado(); return false;
  } finally { S.guardando--; bus.emit('guardando'); }
}

export const guardarIdea = (i) => escribir({ metodo: 'PUT', ruta: `/api/ideas/${encodeURIComponent(i.id)}`, cuerpo: sinSellos(i), clave: `ideas/${i.id}`, alExito: (j) => { upsert(S.estado.ideas, j.doc); S.estado.version = j.version; }, local: () => upsert(S.estado.ideas, sello(i)) });
export const borrarIdea = (id) => escribir({ metodo: 'DELETE', ruta: `/api/ideas/${encodeURIComponent(id)}`, clave: `ideas/${id}/borrar`, alExito: (j) => { S.estado.ideas = S.estado.ideas.filter((x) => x.id !== id); S.estado.version = j.version; }, local: () => { S.estado.ideas = S.estado.ideas.filter((x) => x.id !== id); } });
export const guardarTarea = (t) => escribir({ metodo: 'PUT', ruta: `/api/tareas/${encodeURIComponent(t.id)}`, cuerpo: sinSellos(t), clave: `tareas/${t.id}`, alExito: (j) => { upsert(S.estado.tareas, j.doc); S.estado.version = j.version; }, local: () => upsert(S.estado.tareas, sello(t)) });
export const borrarTarea = (id) => escribir({ metodo: 'DELETE', ruta: `/api/tareas/${encodeURIComponent(id)}`, clave: `tareas/${id}/borrar`, alExito: (j) => { S.estado.tareas = S.estado.tareas.filter((x) => x.id !== id); S.estado.version = j.version; }, local: () => { S.estado.tareas = S.estado.tareas.filter((x) => x.id !== id); } });
export const guardarProspecto = (p) => escribir({ metodo: 'PUT', ruta: `/api/prospectos/${encodeURIComponent(p.id)}`, cuerpo: sinSellos(p), clave: `prospectos/${p.id}`, alExito: (j) => { upsert(S.estado.prospectos, j.doc); S.estado.version = j.version; }, local: () => upsert(S.estado.prospectos, sello(p)) });
export const borrarProspecto = (id) => escribir({ metodo: 'DELETE', ruta: `/api/prospectos/${encodeURIComponent(id)}`, clave: `prospectos/${id}/borrar`, alExito: (j) => { S.estado.prospectos = S.estado.prospectos.filter((x) => x.id !== id); S.estado.version = j.version; }, local: () => { S.estado.prospectos = S.estado.prospectos.filter((x) => x.id !== id); } });
export const guardarIteracion = (it) => escribir({ metodo: 'PUT', ruta: '/api/iteracion', cuerpo: it, clave: 'iteracion', alExito: (j) => { S.estado.iteracion = j.doc; S.estado.version = j.version; }, local: () => { S.estado.iteracion = { ...it }; } });
// El servidor asigna el id del mensaje; sin red el mensaje se pinta con un id provisional `pendiente-<clave>` que recuerda
// su operación en la cola, para que borrarlo antes de que salga retire el POST en vez de mandar un DELETE que nunca coincidiría.
export const enviarMensaje = (texto, ref) => { const clave = `mensajes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; return escribir({ metodo: 'POST', ruta: '/api/mensajes', cuerpo: ref ? { texto, ref } : { texto }, clave, alExito: (j) => { S.estado.mensajes.push(j.doc); S.estado.version = j.version; if (!ref || S.ruta.mod === 'chat') { S.leido = j.doc.fecha; lsSet('mp.chat.leido', j.doc.fecha); } }, local: () => { S.estado.mensajes.push({ id: `pendiente-${clave}`, fecha: ahora(), quien: yo(), texto, ref: ref ? { ...ref, titulo: '' } : null, _pendiente: true }); } }); };
export const borrarMensaje = (id) => {
  if (String(id).startsWith('pendiente-')) { cola.quitar(String(id).slice('pendiente-'.length)); S.estado.mensajes = S.estado.mensajes.filter((m) => m.id !== id); bus.emit('cola'); bus.emit('estado'); return Promise.resolve(true); }
  return escribir({ metodo: 'DELETE', ruta: `/api/mensajes/${encodeURIComponent(id)}`, clave: `mensajes/${id}/borrar`, alExito: (j) => { S.estado.mensajes = S.estado.mensajes.filter((m) => m.id !== id); S.estado.version = j.version; }, local: () => { S.estado.mensajes = S.estado.mensajes.filter((m) => m.id !== id); } });
};

/** Marca el chat como leído hasta el último mensaje (llamar al ver la pestaña). */
export function marcarLeido() {
  const ms = (S.estado && S.estado.mensajes) || []; if (!ms.length) return;
  const ultimo = ms[ms.length - 1].fecha; if (String(ultimo) > String(S.leido || '')) { S.leido = ultimo; lsSet('mp.chat.leido', ultimo); }
}

/* ---------- sondeo de respaldo, recuperación al volver y service worker ---------- */
export function iniciarRespaldo() {
  setInterval(() => { if (S.sinSesion) return; if (!sseAbierto()) cargarEstado().then(() => { if (S.estado && !S.sinSesion && !S.fotoOffline) reconectar(); }); else if (cola.largo) vaciarCola(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !S.sinSesion) { cargarEstado(); reconectar(); } });
  window.addEventListener('online', () => { if (!S.sinSesion) { cargarEstado(); reconectar(); } });
  window.addEventListener('offline', () => setConexion('bad'));
}
export function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const avisar = (w) => { if (!navigator.serviceWorker.controller) return; bus.emit('version-nueva', () => { w.postMessage({ tipo: 'activar' }); }); };
    if (reg.waiting) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed') avisar(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let teniaControl = !!navigator.serviceWorker.controller; let recargando = false;
  // La primera vez que el SW toma control, se vuelve a pedir el estado para que quede una copia para leer sin red.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!teniaControl) { teniaControl = true; if (!S.sinSesion) cargarEstado(); return; } if (recargando) return; recargando = true; window.location.reload(); });
}
