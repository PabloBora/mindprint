/* Utilidades de interfaz: escape, fechas, iconos, avatar, toast, confirmar, panel lateral, foco. Sin DOM al importar. */
import { P, RESP, nombre } from '../estado.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const ligaSegura = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim());

/* ---------- fechas ---------- */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = (n) => String(n).padStart(2, '0');
export function hoy() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function fmtDia(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${parseInt(m[3], 10)} ${MESES[parseInt(m[2], 10) - 1]}` : ''; }
export function fmtFechaHora(iso) { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getDate()} ${MESES[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function relTiempo(iso) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'ahora'; if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`; if (s < 86400 * 1.5) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} d`; return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function diaDe(iso) { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function etiquetaDia(ymd) { const h = hoy(); if (ymd === h) return 'Hoy'; const a = new Date(); a.setDate(a.getDate() - 1); if (ymd === diaDe(a.toISOString())) return 'Ayer'; return fmtDia(ymd); }
export function diasHasta(ymd) { if (!ymd) return null; const a = new Date(`${hoy()}T00:00:00`); const b = new Date(`${ymd}T00:00:00`); return Math.round((b - a) / 86400000); }
export function semanaDe(inicio) { if (!inicio) return null; const d = new Date(`${inicio}T00:00:00`); if (Number.isNaN(d.getTime())) return null; return Math.max(0, Math.floor((Date.now() - d.getTime()) / (7 * 86400000))); }

/* ---------- bus de eventos ---------- */
const oyentes = new Map();
export const bus = {
  on(ev, fn) { if (!oyentes.has(ev)) oyentes.set(ev, new Set()); oyentes.get(ev).add(fn); return () => oyentes.get(ev).delete(fn); },
  emit(ev, data) { (oyentes.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
};

/* ---------- iconos (trazo 24px, un solo set) ---------- */
const P24 = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONOS = {
  hoy: P24('<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>'),
  tareas: P24('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'),
  usuarios: P24('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 13.5A6 6 0 0 1 21.5 19"/>'),
  oportunidades: P24('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.6 1.5 2.6h4c0-1 .6-1.9 1.5-2.6A6 6 0 0 0 12 3z"/>'),
  chat: P24('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>'),
  iteracion: P24('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5.5-5.5 2 2-5.5z"/>'),
  actividad: P24('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  ajustes: P24('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  buscar: P24('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  mas: P24('<path d="M12 5v14M5 12h14"/>'),
  campana: P24('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  salir: P24('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  cerrar: P24('<path d="M18 6L6 18M6 6l12 12"/>'),
  check: P24('<path d="M20 6L9 17l-5-5"/>'),
  puntos: P24('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  atras: P24('<path d="M15 18l-6-6 6-6"/>'),
  borrar: P24('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  enviar: P24('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),
  voto: P24('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>'),
  sol: P24('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  luna: P24('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  auto: P24('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
  drive: P24('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  externo: P24('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>'),
  mover: P24('<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>'),
  reloj: P24('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};
export const icono = (n, cls = '') => (ICONOS[n] || '').replace('class="ic"', `class="ic ${cls}"`);

/* ---------- avatar y pastillas ---------- */
export const avatar = (p, extra = '') => (p && (P()[p] || p === 'todos') ? `<span class="av ${esc(p)} ${extra}" title="${esc(nombre(p))}">${p === 'todos' ? '3' : esc(nombre(p)[0] || '?')}</span>` : '');
export const pill = (texto, tipo = 'soft') => `<span class="pill ${tipo}">${texto}</span>`;

/* ---------- toast (con acción opcional, p. ej. Deshacer) ---------- */
let toastTimer = null;
export function toast(msg, { accion = '', onAccion = null, ms = 2800 } = {}) {
  const t = document.getElementById('toast'); if (!t) return;
  t.innerHTML = `<span>${esc(msg)}</span>${accion ? `<button type="button" class="toast-accion">${esc(accion)}</button>` : ''}`;
  const btn = t.querySelector('.toast-accion');
  if (btn && onAccion) btn.addEventListener('click', () => { t.classList.remove('show'); onAccion(); }, { once: true });
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- confirmar propio (Promise<boolean>) ---------- */
export function confirmar({ titulo = '¿Seguro?', texto = '', ok = 'Sí', cancelar = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolve) => {
    const d = document.getElementById('confirmar'); if (!d) { resolve(window.confirm(`${titulo}\n${texto}`)); return; }
    d.innerHTML = `<form method="dialog" class="confirmar"><h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}<div class="acciones"><button type="button" class="btn" value="no">${esc(cancelar)}</button><button type="button" class="btn ${peligro ? 'peligro' : 'primary'}" value="si">${esc(ok)}</button></div></form>`;
    const fin = (v) => { d.close(); resolve(v); };
    d.querySelector('[value="no"]').addEventListener('click', () => fin(false), { once: true });
    d.querySelector('[value="si"]').addEventListener('click', () => fin(true), { once: true });
    d.addEventListener('cancel', (e) => { e.preventDefault(); fin(false); }, { once: true });
    d.showModal(); d.querySelector('[value="si"]').focus();
  });
}

/* ---------- foco y campos ---------- */
export const esCampoTexto = (el) => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'date', 'number'].includes(el.type));
export function captureFocus(root) {
  const a = document.activeElement; if (!a || !root || !root.contains(a) || !a.dataset || !(a.dataset.bind || a.dataset.keep)) return null;
  return { key: a.dataset.bind || a.dataset.keep, s: a.selectionStart, e: a.selectionEnd, value: a.value };
}
export function restoreFocus(root, k) {
  if (!k || !root) return; const el = root.querySelector(`[data-bind="${k.key}"],[data-keep="${k.key}"]`); if (!el) return;
  if (esCampoTexto(el) && el.value !== k.value) el.value = k.value;
  el.focus({ preventScroll: true }); try { if (k.s != null && el.setSelectionRange) el.setSelectionRange(k.s, k.e); } catch { /* no aplica */ }
}
export function setPath(o, path, v) { const ks = path.split('.'); let cur = o; for (let i = 0; i < ks.length - 1; i++) { if (typeof cur[ks[i]] !== 'object' || cur[ks[i]] === null) cur[ks[i]] = {}; cur = cur[ks[i]]; } cur[ks[ks.length - 1]] = v; }

/* ---------- panel lateral (drawer) con foco atrapado ---------- */
let devolverFoco = null;
const FOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function panelAbierto() { const p = document.getElementById('panel'); return !!(p && !p.hidden); }
export function abrirPanel({ titulo = '', html = '', pie = '' }) {
  const p = document.getElementById('panel'); if (!p) return;
  const yaAbierto = !p.hidden;
  if (!yaAbierto) devolverFoco = document.activeElement;
  const keep = captureFocus(p);
  p.innerHTML = `<div class="panel-cab"><button type="button" class="btn quiet icono" data-act="cerrar-panel" aria-label="Cerrar">${icono('cerrar')}</button><h2 class="panel-titulo">${titulo}</h2></div><div class="panel-cuerpo">${html}</div>${pie ? `<div class="panel-pie">${pie}</div>` : ''}`;
  p.hidden = false; document.body.classList.add('con-panel');
  if (keep) restoreFocus(p, keep);
  else if (!yaAbierto) { const f = p.querySelector('.panel-cuerpo ' + FOCABLES) || p.querySelector(FOCABLES); if (f) f.focus({ preventScroll: true }); }
}
export function cerrarPanel() {
  const p = document.getElementById('panel'); if (!p || p.hidden) return;
  p.hidden = true; p.innerHTML = ''; document.body.classList.remove('con-panel');
  if (devolverFoco && devolverFoco.focus) { try { devolverFoco.focus({ preventScroll: true }); } catch { /* fuera del DOM */ } }
  devolverFoco = null;
}
/** Mantiene Tab dentro del panel mientras esté abierto. Llamar desde el keydown global. */
export function atraparFoco(e) {
  const p = document.getElementById('panel'); if (!p || p.hidden || e.key !== 'Tab') return;
  const f = [...p.querySelectorAll(FOCABLES)].filter((el) => el.offsetParent !== null); if (!f.length) return;
  const primero = f[0]; const ultimo = f[f.length - 1];
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  else if (!p.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
}
