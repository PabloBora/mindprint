/* Arranque de la app: registro de módulos, ruteo por hash, shell (lateral, cabecera, barra inferior),
   panel lateral, búsqueda global, indicador de guardado, delegación de eventos, atajos, arrastre y
   «mover a…», service worker. Los módulos viven en ./modulos/. */
import { S, P, yo, nombre, tareas, esMia, noLeidos, mencionesSinLeer, lsSet, ideaById, tareaById, prospectoById, ESTADOS, ETAPAS_P, STAGES, leerFiltros, guardarFiltros } from './estado.js';
import { actual, ir, reemplazar, escuchar, rutaDe } from './ruta.js';
import { esc, esTactil, icono, avatar, toast, sonar, bus, captureFocus, restoreFocus, abrirPanel, cerrarPanel, panelAbierto, atraparFoco, recordarFoco, hoy } from './ui/base.js';
import { esqueletoLateral, esqueletoCabecera, esqueletoVista } from './ui/piezas.js';
import { panelAyuda } from './ui/ayuda.js';
import { buscarGlobal, GRUPOS } from './buscar.js';
import { cargarEstado, conectarSSE, reconectar, iniciarRespaldo, registrarSW, vaciarCola, cola, guardarIdea, guardarTarea, guardarProspecto } from './api.js';
import hoyMod from './modulos/hoy.js';
import tareasMod from './modulos/tareas.js';
import usuariosMod from './modulos/usuarios.js';
import oportunidadesMod from './modulos/oportunidades.js';
import chatMod from './modulos/chat.js';
import iteracionMod from './modulos/iteracion.js';
import actividadMod from './modulos/actividad.js';
import ajustesMod from './modulos/ajustes.js';

/* ---------- registro de módulos ---------- */
export const MODULOS = new Map();
export function registrar(mod) { MODULOS.set(mod.id, mod); }
[hoyMod, tareasMod, usuariosMod, oportunidadesMod, chatMod, iteracionMod, actividadMod, ajustesMod].forEach(registrar);
const ordenados = () => [...MODULOS.values()].sort((a, b) => (a.orden || 99) - (b.orden || 99));
const modActual = () => MODULOS.get(S.ruta.mod) || MODULOS.get('hoy');

/* ---------- tema ---------- */
function aplicarTema() { const t = S.tema === 'auto' ? '' : S.tema; document.documentElement.setAttribute('data-theme', t); }
function aplicarLetra() { document.documentElement.classList.toggle('letra-grande', S.letra === 'grande'); }
aplicarTema(); aplicarLetra();

/* ---------- render ---------- */
const $ = (id) => document.getElementById(id);
function render() {
  const app = document.body;
  if (S.sinSesion) { app.classList.add('sin-sesion'); app.classList.remove('cargando'); $('vista').innerHTML = viewEntrada(); cerrarPanel(); return; }
  if (!S.estado) {
    $('lateral').innerHTML = esqueletoLateral(); $('cabecera').innerHTML = esqueletoCabecera(); $('inferior').innerHTML = '';
    $('vista').innerHTML = S.conexion === 'bad'
      ? `<div class="vacio error"><b>No se pudo cargar el tablero.</b> Revisa tu conexión; se reintenta solo cada 10 segundos.<div><button type="button" class="btn" data-act="reintentar">${icono('reloj', 'sm')}Reintentar ahora</button></div></div>`
      : esqueletoVista();
    return;
  }
  app.classList.remove('sin-sesion', 'cargando');
  renderShell();
  const vista = $('vista'); const keep = captureFocus(vista);
  const mod = modActual();
  vista.innerHTML = (S.fotoOffline ? '<div class="banner offline"><b>Sin conexión.</b> Ves la última copia guardada. Lo que cambies se guarda en este navegador y se envía cuando vuelva la red.</div>' : '')
    + `<div class="wrap panel-mod" data-mod="${esc(mod.id)}">${mod.vista()}</div>`;
  restoreFocus(vista, keep);
  if (mod.alMostrar) mod.alMostrar();
  renderPanel();
}
function renderShell() {
  if (!S.estado || S.sinSesion) return; // sin estado se muestran el esqueleto o la entrada, no el shell
  const mods = ordenados(); const me = yo();
  const cx = { conectando: ['', 'conectando…'], live: ['on', 'en vivo'], poll: ['warn', 'actualizando cada 10 s'], bad: ['bad', 'sin conexión'] }[S.conexion] || ['', ''];
  const otros = Object.keys(P()).filter((p) => p !== me); const online = otros.filter((p) => S.enLinea.includes(p));
  $('lateral').innerHTML = `<a class="marca" href="#/hoy"><span class="logo"><svg viewBox="0 0 512 512" aria-hidden="true"><path d="M128 368V144h48l80 128 80-128h48v224h-48V232l-80 128-80-128v136z" fill="#FFD84D"/></svg></span><span><b>Mindprint</b><small>tablero</small></span></a>`
    + mods.map((m) => `<a class="nav-item" href="${rutaDe(m.id)}" aria-current="${S.ruta.mod === m.id ? 'page' : 'false'}">${icono(m.icono)}<span>${esc(m.titulo)}</span>${m.badge && m.badge() ? `<span class="n${m.hot && m.hot() ? ' hot' : ''}">${esc(m.badge())}</span>` : ''}</a>`).join('')
    + `<div class="pie"><span class="estado-cx"><span class="dot ${cx[0]}"></span>${cx[1]}${cola.largo ? ` · ${cola.largo} por enviar` : ''}</span><span class="equipo-mini">${otros.map((p) => avatar(p, online.includes(p) ? 'sm' : 'sm off')).join('')} ${online.length ? `${online.map(nombre).join(' y ')} en línea` : 'nadie más en línea'}</span><button type="button" class="lnk ayuda-lnk" data-act="ayuda">Ayuda y atajos <kbd>?</kbd></button></div>`;
  const mod = modActual();
  const vencidas = tareas().filter((t) => esMia(t) && t.estado !== 'hecha' && t.vence && t.vence < hoy()).length;
  const avisos = noLeidos() + vencidas;
  const cab = $('cabecera'); const keep = captureFocus(cab);
  cab.classList.toggle('buscando', !!(S.q || '').trim());
  cab.innerHTML = `<div class="titulo-mod">${icono(mod.icono)}<span class="largo">${esc(mod.titulo)}</span><span class="corto">${esc(mod.corto || mod.titulo)}</span></div>`
    + `<div class="buscar">${icono('buscar')}<input class="in" id="q" data-keep="q" type="search" placeholder="Buscar en todo" value="${esc(S.q || '')}" aria-label="Buscar en todo" autocomplete="off" role="combobox" aria-expanded="${S.busqAbierta && !!buscarGlobal(S.q)}" aria-controls="busq-res" aria-autocomplete="list"><kbd>/</kbd>${renderBusqueda()}</div><button type="button" class="buscar-cancelar" data-act="cerrar-busqueda">Cancelar</button>`
    + `<div class="derecha">${indicadorGuardado()}${S.versionNueva ? `<button type="button" class="version-nueva" data-act="actualizar" title="Hay una versión nueva del tablero">${icono('reloj', 'sm')}<span>Actualizar</span></button>` : ''}<button type="button" class="btn-nuevo" data-act="menu" data-menu="nuevo" aria-haspopup="menu" aria-expanded="${S.menuAbierto === 'nuevo'}">${icono('mas')}<span>Nuevo</span></button>`
    + `<button type="button" class="cab-icono" data-act="menu" data-menu="avisos" aria-label="Avisos" aria-haspopup="menu" aria-expanded="${S.menuAbierto === 'avisos'}">${icono('campana')}${avisos ? `<span class="badge">${avisos}</span>` : ''}</button>`
    + `<button type="button" class="cab-persona" data-act="menu" data-menu="persona" aria-haspopup="menu" aria-expanded="${S.menuAbierto === 'persona'}">${avatar(me)}<span><span class="nom">${esc(nombre(me))}</span><br><span class="rol">${esc((P()[me] || {}).rol || '')}</span></span></button></div>`
    + renderMenu(vencidas);
  restoreFocus(cab, keep);
  const principales = mods.filter((m) => m.principal).slice(0, 4);
  $('inferior').innerHTML = principales.map((m) => `<a href="${rutaDe(m.id)}" aria-current="${S.ruta.mod === m.id ? 'page' : 'false'}">${icono(m.icono)}<span>${esc(m.corto || m.titulo)}</span>${m.badge && m.badge() ? `<span class="n">${esc(m.badge())}</span>` : ''}</a>`).join('')
    + `<button type="button" data-act="menu" data-menu="mas" aria-current="${principales.some((m) => m.id === S.ruta.mod) ? 'false' : 'page'}">${icono('puntos')}<span>Más</span></button>`;
}
/** Estado de guardado en la cabecera: por enviar (sin red) > guardando > guardado (2.5 s) > sin conexión. */
function indicadorGuardado() {
  const n = cola.largo;
  if (n) return `<button type="button" class="guardado-cab warn" data-act="reintentar-cola" title="Cambios guardados en este navegador que aún no llegan al servidor. Toca para reintentar.">${icono('reloj', 'sm')}<span>${n} por enviar</span></button>`;
  if (S.guardando) return '<span class="guardado-cab" role="status"><span class="spin"></span><span>guardando…</span></span>';
  if (S.ultimoGuardado && Date.now() - Date.parse(S.ultimoGuardado) < 2500) return `<span class="guardado-cab ok" role="status">${icono('check', 'sm')}<span>guardado</span></span>`;
  if (S.conexion === 'bad') return '<span class="guardado-cab bad"><span class="dot bad"></span><span>sin conexión</span></span>';
  return '';
}
function renderBusqueda() {
  if (!S.busqAbierta) return '';
  const r = buscarGlobal(S.q); if (!r) return '';
  const grupos = GRUPOS.filter((g) => r[g.k].total);
  if (!grupos.length) return `<div class="busq-res" id="busq-res"><div class="cab">Nada con «${esc(S.q.trim())}»</div></div>`;
  let i = -1;
  return `<div class="busq-res" id="busq-res" role="listbox" aria-label="Resultados">${grupos.map((g) => `<div class="grupo"><div class="cab">${icono(g.icono)}${g.titulo}<span class="n">${r[g.k].total}</span></div>${r[g.k].items.map((it) => { i++; return `<button type="button" class="res" role="option" aria-selected="${i === S.busqIdx}" data-act="abrir-res" data-mod="${it.mod}" data-id="${esc(it.id)}"><span class="t">${esc(it.titulo)}</span>${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ''}</button>`; }).join('')}</div>`).join('')}</div>`;
}
function renderMenu(vencidas) {
  if (!S.menuAbierto) return '';
  const cerrar = '<div class="menu-fondo" data-act="menu-cerrar"></div>';
  if (S.menuAbierto === 'nuevo') return `${cerrar}<div class="menu" role="menu"><button class="item" role="menuitem" data-act="ir" data-ruta="#/tareas/nuevo">${icono('tareas')}Tarea</button><button class="item" role="menuitem" data-act="ir" data-ruta="#/usuarios/nuevo">${icono('usuarios')}Usuario de prueba</button><button class="item" role="menuitem" data-act="ir" data-ruta="#/oportunidades/nuevo">${icono('oportunidades')}Oportunidad</button><button class="item" role="menuitem" data-act="ir" data-ruta="#/chat">${icono('chat')}Mensaje al equipo</button></div>`;
  if (S.menuAbierto === 'avisos') { const nl = noLeidos(); const nm = mencionesSinLeer(); return `${cerrar}<div class="menu" role="menu">${nm ? `<button class="item" role="menuitem" data-act="ir" data-ruta="#/chat">${icono('chat')}${nm === 1 ? 'Te mencionaron una vez' : `Te mencionaron ${nm} veces`}</button>` : ''}${nl ? `<button class="item" role="menuitem" data-act="ir" data-ruta="#/chat">${icono('chat')}${nl} mensaje${nl === 1 ? '' : 's'} sin leer</button>` : ''}${vencidas ? `<button class="item" role="menuitem" data-act="ir" data-ruta="#/tareas">${icono('tareas')}${vencidas} tarea${vencidas === 1 ? '' : 's'} vencida${vencidas === 1 ? '' : 's'}</button>` : ''}${!nl && !vencidas ? '<div class="cab"><span>Sin avisos. Todo al día.</span></div>' : ''}</div>`; }
  if (S.menuAbierto === 'persona') { const me = yo(); return `${cerrar}<div class="menu" role="menu"><div class="cab"><b>${esc(nombre(me))}</b><span>${esc((P()[me] || {}).rol || '')}</span></div><div class="sep"></div>${[['auto', 'Tema del sistema', 'auto'], ['light', 'Tema claro', 'sol'], ['dark', 'Tema oscuro', 'luna']].map(([k, n, ic]) => `<button class="item" role="menuitemradio" data-act="tema" data-v="${k}" aria-pressed="${S.tema === k}">${icono(ic)}${n}</button>`).join('')}<div class="sep"></div><button class="item" role="menuitem" data-act="ir" data-ruta="#/ajustes">${icono('ajustes')}Ajustes</button><button class="item" role="menuitem" data-act="ayuda">${icono('ayuda')}Ayuda y atajos</button><a class="item" role="menuitem" href="https://drive.google.com/drive/folders/1RiT2jf0FVqJdx-KTnQBxuYEWU7-CnKW-" target="_blank" rel="noopener">${icono('drive')}Carpeta en Drive</a><a class="item" role="menuitem" href="/salir" data-act="salir">${icono('salir')}Salir</a></div>`; }
  if (S.menuAbierto === 'mas') return `${cerrar}<div class="menu" role="menu">${ordenados().filter((m) => !m.principal).map((m) => `<button class="item" role="menuitem" data-act="ir" data-ruta="${rutaDe(m.id)}">${icono(m.icono)}${esc(m.titulo)}</button>`).join('')}<button class="item" role="menuitem" data-act="ayuda">${icono('ayuda')}Ayuda y atajos</button></div>`;
  if (S.menuAbierto === 'mover' && S.mover) {
    const { kind, id } = S.mover; const doc = docDe(kind, id); if (!doc) return '';
    const cols = kind === 'tarea' ? ESTADOS : kind === 'prospecto' ? ETAPAS_P : STAGES; const enCol = kind === 'tarea' ? doc.estado : doc.etapa;
    return `<div class="menu-fondo dim" data-act="menu-cerrar"></div><div class="menu hoja" role="menu" aria-label="Mover a"><div class="cab"><b>${esc(kind === 'prospecto' ? doc.empresa : doc.titulo)}</b><span>Mover a…</span></div>${cols.map(([k, n]) => `<button class="item" role="menuitemradio" aria-pressed="${k === enCol}" data-act="mover-a" data-col="${k}"${k === enCol ? ' disabled' : ''}>${k === enCol ? icono('check') : '<span class="ic"></span>'}${n}</button>`).join('')}</div>`;
  }
  return '';
}
function renderPanel() {
  if (S.ayuda) { abrirPanel(panelAyuda(S.version)); return; }
  const mod = modActual();
  if (!S.ruta.id || !mod.panel) { cerrarPanel(); return; }
  const contenido = mod.panel(S.ruta.id);
  if (!contenido) { reemplazar(rutaDe(mod.id)); return; }
  abrirPanel(contenido);
}
function viewEntrada() {
  return `<div class="entrada"><div class="card-e">
    <a class="marca" href="#/"><span class="logo"><svg viewBox="0 0 512 512" aria-hidden="true"><path d="M128 368V144h48l80 128 80-128h48v224h-48V232l-80 128-80-128v136z" fill="#FFD84D"/></svg></span><span><b>Mindprint</b><small>tablero</small></span></a>
    <p>Aquí trabajan tres personas. Se entra con una liga personal, sin contraseña.</p>
    <div class="personas">${Object.keys(P()).map((p) => `<div class="persona">${avatar(p, 'lg')}<span class="nom">${esc(P()[p].nombre)}</span><span class="rol">${esc(P()[p].rol)}</span></div>`).join('')}</div>
    <form data-submit="entrar"><input class="in" id="liga" data-keep="liga" placeholder="Pega tu liga personal" autocomplete="off" required><button class="btn primary" type="submit">Entrar</button></form>
    ${S.errEntrada ? `<div class="err">${esc(S.errEntrada)}</div>` : ''}
    <div class="ayuda">Pablo te la mandó por privado. Si ya habías entrado en este navegador y ves esto, tu sesión venció (dura 90 días): vuelve a abrir tu liga.</div>
  </div></div>`;
}

S.render = render;

/* ---------- mover entre columnas (arrastre en escritorio, «mover a…» en móvil) ---------- */
const docDe = (kind, id) => (kind === 'tarea' ? tareaById(id) : kind === 'prospecto' ? prospectoById(id) : ideaById(id));
async function moverA(kind, id, destino, etiqueta) {
  if (kind === 'tarea') { const t = tareaById(id); if (t && t.estado !== destino && await guardarTarea({ ...t, estado: destino })) toast(`«${t.titulo}» → ${etiqueta}`); return; }
  if (kind === 'prospecto') { const p = prospectoById(id); if (p && p.etapa !== destino && await guardarProspecto({ ...p, etapa: destino })) toast(`«${p.empresa}» → ${etiqueta}`); return; }
  const i = ideaById(id); if (i && i.etapa !== destino && await guardarIdea({ ...i, etapa: destino })) toast(`«${i.titulo}» → ${etiqueta}`);
}
function cerrarAyuda() { S.ayuda = false; cerrarPanel(); render(); }

/* ---------- eventos ---------- */
// En pantallas táctiles Enter es salto de línea (como en las apps de chat) y se envía con el botón.
const tactil = esTactil;
// «Cancelar» no debe quitarle el foco a la caja antes del clic: si la cabecera se re-acomoda, el toque se pierde.
document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('[data-act="cerrar-busqueda"]')) e.preventDefault(); });
let tGuardado = null;
/* sonido al llegar un mensaje de otro (si está activado y no se está viendo el chat) */
let ultimoMsg = null;
function avisarMensajes() {
  const ms = (S.estado && S.estado.mensajes) || []; if (!ms.length) return;
  const max = ms.reduce((a, m) => (!m._pendiente && String(m.fecha) > a ? String(m.fecha) : a), '');
  if (ultimoMsg === null) { ultimoMsg = max; return; } // primera carga: no suena por lo viejo
  if (max <= ultimoMsg) return;
  const nuevos = ms.filter((m) => !m._pendiente && String(m.fecha) > ultimoMsg && m.quien !== yo()); ultimoMsg = max;
  if (S.sonido && nuevos.length && (document.visibilityState !== 'visible' || S.ruta.mod !== 'chat')) sonar();
}
bus.on('estado', () => { avisarMensajes(); render(); }); bus.on('presencia', renderShell);
bus.on('prefs', (x) => { if (x && x.reset) { S.tema = 'auto'; S.letra = 'normal'; S.sonido = false; S.f = leerFiltros(); } aplicarTema(); aplicarLetra(); render(); }); bus.on('conexion', renderShell); bus.on('cola', renderShell);
bus.on('guardando', () => { renderShell(); clearTimeout(tGuardado); if (!S.guardando) tGuardado = setTimeout(renderShell, 2600); });
bus.on('sin-sesion', render);
bus.on('error', (e) => { if (typeof e === 'string') toast(e); else toast(e.msg, { accion: 'Reintentar', onAccion: e.reintentar, ms: 8000 }); });
bus.on('version-nueva', (activar) => { S.versionNueva = activar; renderShell(); toast('Hay una versión nueva del tablero', { accion: 'Actualizar', onAccion: activar, ms: 8000 }); });

document.addEventListener('click', async (e) => {
  if (S.busqAbierta && !(e.target.closest && e.target.closest('.buscar'))) { S.busqAbierta = false; S.busqIdx = -1; renderShell(); }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'menu') { S.menuAbierto = S.menuAbierto === el.dataset.menu ? null : el.dataset.menu; renderShell(); return; }
  if (act === 'menu-cerrar') { S.menuAbierto = null; S.mover = null; renderShell(); return; }
  if (act === 'ir') { S.menuAbierto = null; ir(el.dataset.ruta); return; }
  if (act === 'tema') { S.tema = el.dataset.v; lsSet('mp.tema', S.tema); aplicarTema(); S.menuAbierto = null; render(); return; }
  if (act === 'colapsar') { const t = S.f[el.dataset.tablero]; if (!t || !Array.isArray(t.colapsadas)) return; const k = el.dataset.col; t.colapsadas = t.colapsadas.includes(k) ? t.colapsadas.filter((x) => x !== k) : [...t.colapsadas, k]; guardarFiltros(); render(); const b = document.querySelector(`[data-act="colapsar"][data-tablero="${el.dataset.tablero}"][data-col="${k}"]`); if (b) b.focus(); return; }
  if (act === 'cerrar-panel') { if (S.ayuda) { cerrarAyuda(); return; } reemplazar(rutaDe(S.ruta.mod)); return; }
  if (act === 'abrir') { recordarFoco(`[data-act="abrir"][data-mod="${el.dataset.mod}"][data-id="${el.dataset.id}"]`); ir(rutaDe(el.dataset.mod, el.dataset.id)); return; }
  if (act === 'abrir-res') { S.busqAbierta = false; S.busqIdx = -1; S.q = ''; ir(rutaDe(el.dataset.mod, el.dataset.id)); return; }
  if (act === 'cerrar-busqueda') { S.q = ''; S.busqAbierta = false; S.busqIdx = -1; const q = $('q'); if (q) q.blur(); render(); return; }
  if (act === 'ayuda') { recordarFoco(el.closest('#lateral') ? '#lateral [data-act="ayuda"]' : S.menuAbierto === 'mas' ? '[data-menu="mas"]' : '[data-menu="persona"]'); S.menuAbierto = null; S.ayuda = true; render(); return; }
  if (act === 'salir') { cola.limpiar(); return; } // el enlace sigue a /salir; lo pendiente de otra sesión no debe quedarse en este navegador
  if (act === 'actualizar') { if (S.versionNueva) S.versionNueva(); return; }
  if (act === 'reintentar') { S.conexion = 'conectando'; render(); await cargarEstado(); if (S.estado && !S.sinSesion) reconectar(); return; }
  if (act === 'reintentar-cola') { const antes = cola.largo; await vaciarCola(); if (cola.largo) toast('Todavía no hay conexión con el servidor. Los cambios siguen guardados aquí.'); else if (antes) toast('Cambios enviados'); return; }
  if (act === 'mover') { S.mover = { kind: el.dataset.kind, id: el.dataset.id }; S.menuAbierto = 'mover'; recordarFoco(`[data-act="mover"][data-id="${el.dataset.id}"]`); renderShell(); const primero = document.querySelector('.menu.hoja .item:not([disabled])'); if (primero) primero.focus(); return; }
  if (act === 'mover-a') { const m = S.mover; S.menuAbierto = null; S.mover = null; renderShell(); if (m) await moverA(m.kind, m.id, el.dataset.col, el.textContent.trim()); return; }
  for (const mod of MODULOS.values()) { const fn = mod.acciones && mod.acciones[act]; if (fn) { await fn(el, e); return; } }
});
document.addEventListener('focusin', (e) => { if (e.target && e.target.id === 'q' && !S.busqAbierta && (S.q || '').trim().length >= 2) { S.busqAbierta = true; renderShell(); } });
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-submit]'); if (!f) return; e.preventDefault();
  const nombreSubmit = f.dataset.submit;
  if (nombreSubmit === 'entrar') {
    const v = ($('liga').value || '').trim();
    const m = /\/entrar\/([A-Za-z0-9_-]{16,})/.exec(v) || (/^[A-Za-z0-9_-]{16,}$/.test(v) ? [null, v] : null);
    if (!m) { S.errEntrada = 'Eso no parece una liga del tablero. Debe terminar en /entrar/… seguido de tu clave.'; render(); return; }
    window.location.href = `/entrar/${m[1]}`; return;
  }
  for (const mod of MODULOS.values()) { const fn = mod.submits && mod.submits[nombreSubmit]; if (fn) { await fn(f); return; } }
});
/* campos enlazados: selects/checkbox/date al cambiar; texto con pausa */
const timers = {};
function applyBind(el, inmediato) {
  if (!S.estado) return;
  const [col, id, campo] = el.dataset.bind.split(':'); if (!col) return;
  let val = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') val = parseInt(val, 10) || (campo === 'semanas' ? 6 : 1);
  const run = async () => { for (const mod of MODULOS.values()) { const fn = mod.binds && mod.binds[col]; if (fn) { await fn(id, campo, val); return; } } };
  clearTimeout(timers[el.dataset.bind]);
  if (inmediato) run(); else timers[el.dataset.bind] = setTimeout(run, 600);
}
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.dataset) return;
  if (el.dataset.keep === 'q') { S.q = el.value; S.busqAbierta = true; S.busqIdx = -1; clearTimeout(timers.q); timers.q = setTimeout(render, 150); return; }
  if (!el.dataset.bind || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') return;
  applyBind(el, false);
});
document.addEventListener('change', (e) => { const el = e.target; if (!el.dataset) return; if (el.dataset.filtro) { const mod = modActual(); if (mod.filtros) { mod.filtros(el.dataset.filtro, el.value); render(); } return; } if (!el.dataset.bind) return; applyBind(el, true); });
document.addEventListener('keydown', (e) => {
  atraparFoco(e);
  if (e.target && e.target.id === 'q') { // navegación en los resultados de la búsqueda global
    const res = [...document.querySelectorAll('#busq-res .res')];
    if (e.key === 'ArrowDown' && res.length) { e.preventDefault(); S.busqIdx = Math.min(S.busqIdx + 1, res.length - 1); renderShell(); return; }
    if (e.key === 'ArrowUp' && res.length) { e.preventDefault(); S.busqIdx = Math.max(S.busqIdx - 1, -1); renderShell(); return; }
    if (e.key === 'Enter' && res.length) { e.preventDefault(); (res[Math.max(0, S.busqIdx)]).click(); return; }
    if (e.key === 'Escape') { e.preventDefault(); S.q = ''; S.busqAbierta = false; S.busqIdx = -1; e.target.blur(); render(); return; }
  }
  if (e.key === 'Escape') { if (S.busqAbierta) { S.busqAbierta = false; S.busqIdx = -1; renderShell(); const q = $('q'); if (q) q.focus(); return; } if (S.menuAbierto) { S.menuAbierto = null; S.mover = null; renderShell(); return; } if (S.ayuda) { cerrarAyuda(); return; } if (panelAbierto()) { reemplazar(rutaDe(S.ruta.mod)); return; } }
  const enCampo = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable);
  if (e.key === 'Enter' && e.target.closest && e.target.closest('.card[data-act]') && !e.target.closest('button')) { e.preventDefault(); e.target.closest('.card').click(); return; }
  if (e.key === 'Enter' && !e.shiftKey && !tactil() && e.target.tagName === 'TEXTAREA' && e.target.closest && e.target.closest('form[data-submit="add-msg"]')) { e.preventDefault(); const f = e.target.closest('form'); if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); return; }
  if (enCampo || e.ctrlKey || e.metaKey || e.altKey || !S.estado) return;
  if (e.key === '/') { e.preventDefault(); const q = $('q'); if (q) { q.focus(); q.select(); } return; }
  if (e.key === '?') { e.preventDefault(); if (S.ayuda) cerrarAyuda(); else { S.ayuda = true; render(); } return; }
  if (e.key === 'n') { e.preventDefault(); const mod = modActual(); if (mod.nuevo) ir(rutaDe(mod.id, 'nuevo')); return; }
  if (e.key === 'g') { S.chordG = Date.now(); return; }
  if (S.chordG && Date.now() - S.chordG < 1200) { const map = { h: 'hoy', t: 'tareas', u: 'usuarios', o: 'oportunidades', c: 'chat', i: 'iteracion', a: 'actividad', s: 'ajustes' }; if (map[e.key]) { e.preventDefault(); ir(rutaDe(map[e.key])); } S.chordG = 0; }
});

/* arrastrar tarjetas entre columnas (escritorio); el tipo lo dice data-kind */
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.card[draggable]'); if (!c) return; S.arrastrando = c.dataset.id; S.arrastrandoKind = c.dataset.kind || 'idea'; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* no aplica */ } });
document.addEventListener('dragend', () => { S.arrastrando = null; document.querySelectorAll('.card.drag').forEach((c) => c.classList.remove('drag')); document.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over')); });
document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col || !S.arrastrando || col.dataset.kind !== S.arrastrandoKind) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch { /* no aplica */ } document.querySelectorAll('.col.over').forEach((c) => { if (c !== col) c.classList.remove('over'); }); col.classList.add('over'); });
document.addEventListener('dragleave', (e) => { const col = e.target.closest && e.target.closest('.col[data-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
document.addEventListener('drop', async (e) => {
  const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col || !S.arrastrando) return; e.preventDefault();
  const id = S.arrastrando; const destino = col.dataset.col; const kind = col.dataset.kind; S.arrastrando = null; col.classList.remove('over');
  const etiqueta = col.querySelector('h3 span') ? col.querySelector('h3 span').textContent : destino;
  await moverA(kind, id, destino, etiqueta);
});

/* ---------- ruteo y arranque ---------- */
function alCambiarRuta(r) { const previo = MODULOS.get(S.ruta.mod); if (previo && previo.alSalir && previo.id !== r.mod) previo.alSalir(); if (S.ruta.mod !== r.mod) S.q = ''; S.ruta = r; S.menuAbierto = null; S.mover = null; S.busqAbierta = false; S.busqIdx = -1; if (S.ayuda) { S.ayuda = false; cerrarPanel(); } if (!MODULOS.has(r.mod)) { reemplazar(rutaDe('hoy')); return; } render(); }
escuchar(alCambiarRuta);
S.ruta = actual(); S.q = '';
if (!MODULOS.has(S.ruta.mod)) reemplazar(rutaDe('hoy'));
render();
cargarEstado().then(() => { if (S.sinSesion) return; iniciarRespaldo(); if (S.estado && !S.fotoOffline) conectarSSE(); });
registrarSW();
fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => { S.version = j.version || ''; }).catch(() => {});
