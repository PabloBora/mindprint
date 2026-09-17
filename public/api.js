/* Capa de red: API del servidor, avisos en vivo (SSE) con sondeo de respaldo, y escrituras con upsert local.
   Emite por el bus: 'estado' (hay datos nuevos), 'sin-sesion', 'conexion', 'guardando'. */
import { S, yo, lsSet } from './estado.js';
import { bus } from './ui/base.js';

let es = null;

export async function api(metodo, ruta, cuerpo) {
  const r = await fetch(ruta, { method: metodo, credentials: 'same-origin', headers: cuerpo ? { 'content-type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (r.status === 401) { sinSesion(); const e = new Error('sin_sesion'); e.code = 'sin_sesion'; throw e; }
  let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) { const e = new Error((j && j.detalle) || (j && j.error) || `HTTP ${r.status}`); e.code = (j && j.error) || 'error'; e.status = r.status; throw e; }
  return j;
}

export function mensajeError(e) {
  if (e.code === 'sin_votos') return 'Ya usaste tus 3 votos. Quita uno de otra oportunidad para votar esta.';
  if (e.code === 'titulo_requerido') return 'Falta el título.';
  if (e.code === 'empresa_requerida') return 'Falta el nombre de la persona o empresa.';
  if (e.code === 'ajeno') return 'Solo quien escribió el mensaje puede borrarlo.';
  if (e.status >= 500 || !e.status) return 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
  return e.message;
}

function sinSesion() {
  S.sinSesion = true; S.estado = null; S.yo = null;
  if (es) { es.close(); es = null; }
  bus.emit('sin-sesion');
}
function setConexion(c) { if (S.conexion !== c) { S.conexion = c; bus.emit('conexion', c); } }

export async function cargarEstado() {
  try {
    const j = await api('GET', '/api/estado');
    S.estado = j; S.yo = j.yo; S.enLinea = j.enLinea || []; S.sinSesion = false;
    if (S.conexion !== 'live') setConexion(es && es.readyState === 1 ? 'live' : 'poll');
    bus.emit('estado');
  } catch (e) { if (e.code !== 'sin_sesion') { setConexion('bad'); bus.emit('estado'); } }
}

export function conectarSSE() {
  if (!('EventSource' in window)) { setConexion('poll'); return; }
  if (es) es.close();
  es = new EventSource('/api/eventos');
  es.addEventListener('hola', (ev) => { setConexion('live'); const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); });
  es.addEventListener('cambio', (ev) => { const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); });
  es.addEventListener('presencia', (ev) => { S.enLinea = JSON.parse(ev.data).enLinea || []; bus.emit('presencia'); });
  es.onerror = () => { if (S.conexion === 'live') setConexion('poll'); };
}
export function sseAbierto() { return !!(es && es.readyState === 1); }
export function reconectar() { if (es && es.readyState === 2) conectarSSE(); }

/* ---------- escrituras (upsert local + aviso) ---------- */
const sinSellos = (d) => { const o = { ...d }; delete o.actualizado; delete o.actualizadoPor; return o; };
function upsert(lista, doc) { const i = lista.findIndex((x) => x.id === doc.id); if (i >= 0) lista[i] = doc; else lista.push(doc); }
async function escribir(fn) {
  S.guardando++; bus.emit('guardando');
  try { const r = await fn(); S.ultimoGuardado = new Date().toISOString(); return r; }
  finally { S.guardando--; bus.emit('guardando'); }
}
async function conError(fn) {
  try { return await escribir(fn); }
  catch (e) { if (e.code !== 'sin_sesion') { bus.emit('error', mensajeError(e)); await cargarEstado(); } return false; }
}

export const guardarIdea = (idea) => conError(async () => { const j = await api('PUT', `/api/ideas/${encodeURIComponent(idea.id)}`, sinSellos(idea)); upsert(S.estado.ideas, j.doc); S.estado.version = j.version; bus.emit('estado'); return j.doc; });
export const borrarIdea = (id) => conError(async () => { const j = await api('DELETE', `/api/ideas/${encodeURIComponent(id)}`); S.estado.ideas = S.estado.ideas.filter((i) => i.id !== id); S.estado.version = j.version; bus.emit('estado'); return true; });
export const guardarTarea = (t) => conError(async () => { const j = await api('PUT', `/api/tareas/${encodeURIComponent(t.id)}`, sinSellos(t)); upsert(S.estado.tareas, j.doc); S.estado.version = j.version; bus.emit('estado'); return j.doc; });
export const borrarTarea = (id) => conError(async () => { const j = await api('DELETE', `/api/tareas/${encodeURIComponent(id)}`); S.estado.tareas = S.estado.tareas.filter((t) => t.id !== id); S.estado.version = j.version; bus.emit('estado'); return true; });
export const guardarProspecto = (p) => conError(async () => { const j = await api('PUT', `/api/prospectos/${encodeURIComponent(p.id)}`, sinSellos(p)); upsert(S.estado.prospectos, j.doc); S.estado.version = j.version; bus.emit('estado'); return j.doc; });
export const borrarProspecto = (id) => conError(async () => { const j = await api('DELETE', `/api/prospectos/${encodeURIComponent(id)}`); S.estado.prospectos = S.estado.prospectos.filter((p) => p.id !== id); S.estado.version = j.version; bus.emit('estado'); return true; });
export const guardarIteracion = (it) => conError(async () => { const j = await api('PUT', '/api/iteracion', it); S.estado.iteracion = j.doc; S.estado.version = j.version; bus.emit('estado'); return j.doc; });
export const enviarMensaje = (texto, ref) => conError(async () => { const j = await api('POST', '/api/mensajes', ref ? { texto, ref } : { texto }); S.estado.mensajes.push(j.doc); S.estado.version = j.version; if (!ref || S.ruta.mod === 'chat') { S.leido = j.doc.fecha; lsSet('mp.chat.leido', j.doc.fecha); } bus.emit('estado'); return j.doc; });
export const borrarMensaje = (id) => conError(async () => { const j = await api('DELETE', `/api/mensajes/${encodeURIComponent(id)}`); S.estado.mensajes = S.estado.mensajes.filter((m) => m.id !== id); S.estado.version = j.version; bus.emit('estado'); return true; });

/** Marca el chat como leído hasta el último mensaje (llamar al ver la pestaña). */
export function marcarLeido() {
  const ms = (S.estado && S.estado.mensajes) || []; if (!ms.length) return;
  const ultimo = ms[ms.length - 1].fecha; if (String(ultimo) > String(S.leido || '')) { S.leido = ultimo; lsSet('mp.chat.leido', ultimo); }
}

/* ---------- sondeo de respaldo y recuperación al volver ---------- */
export function iniciarRespaldo() {
  setInterval(() => { if (S.sinSesion) return; if (!sseAbierto()) cargarEstado(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !S.sinSesion) { cargarEstado(); reconectar(); } });
  window.addEventListener('online', () => { if (!S.sinSesion) { cargarEstado(); reconectar(); } });
  window.addEventListener('offline', () => setConexion('bad'));
}
