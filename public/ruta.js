/* Rutas por hash: #/<modulo>[/<id>[/<sub>]]. Funciones puras: se importan sin DOM. */
export const RUTA_DEFAULT = 'hoy';

export function parsear(hash) {
  const limpio = String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
  const partes = limpio ? limpio.split('/').map((s) => { try { return decodeURIComponent(s); } catch { return s; } }) : [];
  const [mod, id, sub] = partes;
  return { mod: mod || RUTA_DEFAULT, id: id || null, sub: sub || null };
}

export function rutaDe(mod, id, sub) {
  return `#/${[mod, id, sub].filter(Boolean).map((s) => encodeURIComponent(String(s))).join('/')}`;
}

export function actual() {
  return parsear(typeof window !== 'undefined' ? window.location.hash : '');
}

export function ir(ruta) {
  if (typeof window === 'undefined') return;
  if (window.location.hash === ruta) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
  window.location.hash = ruta;
}

/** Sustituye la ruta actual sin crear entrada en el historial (cerrar un panel, por ejemplo). */
export function reemplazar(ruta) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', ruta);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function escuchar(cb) {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb(actual());
  window.addEventListener('hashchange', h);
  return () => window.removeEventListener('hashchange', h);
}
