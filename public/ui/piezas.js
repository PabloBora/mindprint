/* Piezas compartidas entre módulos: tarjetas, renglones, señales, comentarios y actividad. */
import { S, P, yo, nombre, RESP, FASES, STAGES, ESTADOS, CRIT, REACC, ETAPAS_P, ideaById, comentariosDe, votosIdea, reaccCount, nSenales, enJuego, etiquetaEtapaP, refInfo } from '../estado.js';
import { esc, icono, avatar, fmtDia, fmtFechaHora, relTiempo, diasHasta, ligaSegura } from './base.js';

/* ---- tableros: columnas plegables (en escritorio) ---- */
/** Una columna de tablero. Plegada solo se ve angosta en escritorio; en el teléfono (una columna a la vez) se ve completa. */
export function colTablero({ tablero, kind, k, label, total, cards, activa, plegada, hl = false, pie = '' }) {
  return `<section class="col${activa ? ' active' : ''}${total ? '' : ' empty'}${plegada ? ' plegada' : ''}" data-col="${k}" data-kind="${kind}">`
    + `<h3><button type="button" class="col-cab" data-act="colapsar" data-tablero="${tablero}" data-col="${k}" aria-expanded="${!plegada}" title="${plegada ? 'Mostrar' : 'Plegar'} la columna"><span class="${hl ? 'hl' : ''}">${label}</span><span class="n">${total}</span></button></h3>`
    + `<div class="cards">${cards}</div>${pie}</section>`;
}
/** grid-template-columns del tablero: las plegadas angostas, las demás a partes iguales. */
export const columnasGrid = (claves, plegadas) => claves.map((k) => (plegadas.includes(k) ? '44px' : 'minmax(0,1fr)')).join(' ');
export const selectOrden = (tablero, actual, opciones) => `<select class="in orden" data-filtro="orden" aria-label="Orden">${opciones.map(([k, n]) => `<option value="${k}"${actual === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`;

/* ---- comunes ---- */
/** Botón «mover a…»: siempre visible en el teléfono (no hay arrastre) y al pasar el cursor o enfocar en escritorio. */
export const btnMover = (kind, id) => `<button class="mover" type="button" data-act="mover" data-kind="${kind}" data-id="${esc(id)}" aria-label="Mover a otra columna" title="Mover a…">${icono('mover', 'sm')}</button>`;
export const pillPendiente = (d) => (d._pendiente ? '<span class="pill warn" title="Guardado en este navegador; se envía al volver la red">por enviar</span>' : '');

/* ---- esqueletos de carga (mismo markup que trae index.html) ---- */
const sk = (w, h = 14) => `<div class="sk" style="width:${w};height:${h}px"></div>`;
export const esqueletoLateral = () => `<div class="sk-bloque" aria-hidden="true">${sk('70%', 28)}<div class="sk-sep"></div>${sk('80%', 18)}${sk('65%', 18)}${sk('90%', 18)}${sk('75%', 18)}${sk('55%', 18)}${sk('70%', 18)}${sk('60%', 18)}</div>`;
export const esqueletoCabecera = () => `<div class="sk-fila" aria-hidden="true">${sk('120px', 22)}${sk('min(320px,40%)', 34)}<span class="sk-espacio"></span>${sk('84px', 32)}${sk('34px', 34)}</div>`;
export const esqueletoVista = () => `<div class="wrap sk-bloque" aria-hidden="true" aria-busy="true"><div class="sk-caja">${sk('45%', 24)}${sk('100%', 8)}${sk('60%', 14)}</div><div class="sk-grid"><div class="sk-caja">${sk('40%', 20)}${sk('100%', 36)}${sk('90%', 14)}${sk('75%', 14)}${sk('85%', 14)}</div><div class="sk-caja">${sk('50%', 20)}${sk('80%', 14)}${sk('70%', 14)}${sk('88%', 14)}</div></div></div>`;

/* ---- tareas ---- */
export function pillVence(t) {
  if (!t.vence) return '';
  if (t.estado === 'hecha') return `<span class="tag">${fmtDia(t.vence)}</span>`;
  const d = diasHasta(t.vence);
  if (d < 0) return `<span class="pill bad">vencida ${fmtDia(t.vence)}</span>`;
  if (d === 0) return '<span class="pill warn">vence hoy</span>';
  if (d === 1) return '<span class="pill warn">vence mañana</span>';
  return `<span class="tag">vence ${fmtDia(t.vence)}</span>`;
}
export const pillEstado = (t) => (t.estado === 'en_curso' ? '<span class="pill soft">en curso</span>' : t.estado === 'bloqueada' ? `<span class="pill bad">bloqueada${t.motivo ? `: ${esc(t.motivo)}` : ''}</span>` : '');
const btnCheck = (t) => `<button class="check${t.estado === 'hecha' ? ' on' : ''}" type="button" data-act="hecha" data-id="${esc(t.id)}" aria-label="${t.estado === 'hecha' ? 'Reabrir' : 'Marcar hecha'}">✓</button>`;
export function itemTarea(t) {
  return `<div class="item-t${t.estado === 'hecha' ? ' hecha' : ''}">${btnCheck(t)}<div><button class="tit" type="button" data-act="abrir" data-mod="tareas" data-id="${esc(t.id)}">${esc(t.titulo)}</button><div class="tags">${t.responsable === 'todos' ? '<span class="pill soft">los tres</span>' : ''}${pillEstado(t)}${pillVence(t)}${t.fase !== 'general' ? `<span class="tag">${esc(FASES[t.fase] || t.fase)}</span>` : ''}</div></div></div>`;
}
export function cardTarea(t) {
  const idea = t.ideaId ? ideaById(t.ideaId) : null; const nc = comentariosDe('tarea', t.id).length;
  return `<div class="card tarea ${t.estado}${t._pendiente ? ' por-enviar' : ''}" role="button" tabindex="0" draggable="true" data-kind="tarea" data-act="abrir" data-mod="tareas" data-id="${esc(t.id)}">${btnCheck(t)}${btnMover('tarea', t.id)}`
    + `<div class="t">${esc(t.titulo)}</div>${t.detalle ? `<div class="d">${esc(t.detalle)}</div>` : ''}${t.estado === 'bloqueada' && t.motivo ? `<div class="motivo">${esc(t.motivo)}</div>` : ''}`
    + `<div class="meta">${avatar(t.responsable, 'sm')}<span>${esc(RESP[t.responsable] || '')}</span>${pillVence(t)}${t.fase !== 'general' ? `<span class="tag">${esc(FASES[t.fase] || t.fase)}</span>` : ''}${idea ? `<span class="tag" title="${esc(idea.titulo)}">oportunidad</span>` : ''}${nc ? `<span class="tag">${nc} coment.</span>` : ''}${pillPendiente(t)}</div></div>`;
}

/* ---- usuarios de prueba ---- */
export function pillSiguiente(p) {
  if (!p.fechaSiguiente || !enJuego(p)) return p.fechaSiguiente ? `<span class="tag">${fmtDia(p.fechaSiguiente)}</span>` : '';
  const d = diasHasta(p.fechaSiguiente);
  if (d < 0) return `<span class="pill bad">venció ${fmtDia(p.fechaSiguiente)}</span>`;
  if (d === 0) return '<span class="pill warn">hoy</span>';
  if (d === 1) return '<span class="pill warn">mañana</span>';
  return `<span class="tag">${fmtDia(p.fechaSiguiente)}</span>`;
}
export const pillSenales = (p) => { const n = nSenales(p); return n ? `<span class="pill ok">${n} señal${n === 1 ? '' : 'es'}</span>` : ''; };
export function cardProspecto(p) {
  const caso = p.casoId ? ideaById(p.casoId) : null; const nc = comentariosDe('prospecto', p.id).length;
  return `<div class="card prospecto${p._pendiente ? ' por-enviar' : ''}" role="button" tabindex="0" draggable="true" data-kind="prospecto" data-act="abrir" data-mod="usuarios" data-id="${esc(p.id)}">${btnMover('prospecto', p.id)}`
    + `<div class="t">${esc(p.empresa)}</div>${(p.contacto || p.relacion || p.area) ? `<div class="d">${esc([p.contacto, p.relacion, p.area].filter(Boolean).join(' · '))}</div>` : ''}${p.siguientePaso ? `<div class="d"><span class="k">siguiente</span> ${esc(p.siguientePaso)}</div>` : ''}`
    + `<div class="meta">${avatar(p.responsable, 'sm')}${pillSenales(p)}${pillSiguiente(p)}${caso ? `<span class="tag" title="${esc(caso.titulo)}">${esc(caso.titulo.slice(0, 28))}${caso.titulo.length > 28 ? '…' : ''}</span>` : ''}${nc ? `<span class="tag">${nc} coment.</span>` : ''}${pillPendiente(p)}</div></div>`;
}
export function itemProspecto(p) {
  return `<div class="item-t">${avatar(p.responsable, 'sm')}<div><button class="tit" type="button" data-act="abrir" data-mod="usuarios" data-id="${esc(p.id)}">${esc(p.empresa)}</button><div class="tags"><span class="pill soft">${esc(etiquetaEtapaP(p.etapa))}</span>${pillSenales(p)}${p.siguientePaso ? `<span>${esc(p.siguientePaso)}</span>` : ''}${pillSiguiente(p)}</div></div></div>`;
}

/* ---- oportunidades ---- */
export function cardIdea(i) {
  const c = i.criterios || {}; const rc = reaccCount(i); const v = i.votos || {};
  const rx = REACC.filter((r) => rc[r[0]]).map((r) => `${rc[r[0]]} ${r[1].toLowerCase()}`).join(' · ');
  const voters = Object.keys(P()).filter((p) => v[p]); const nc = comentariosDe('idea', i.id).length;
  return `<div class="card${i._pendiente ? ' por-enviar' : ''}" role="button" tabindex="0" draggable="true" data-kind="idea" data-act="abrir" data-mod="oportunidades" data-id="${esc(i.id)}">${btnMover('idea', i.id)}
    <div class="t">${esc(i.titulo || '(sin título)')}</div>${i.dolor ? `<div class="d">${esc(i.dolor)}</div>` : ''}
    <div class="meta">${i.autor ? avatar(i.autor, 'sm') : ''}<span class="crit" title="común · dolor · estándar · construible">${CRIT.map((k) => `<i class="l${c[k[0]] || 0}"></i>`).join('')}</span><span class="votos" title="votos">${icono('voto', 'sm')} ${votosIdea(i)}${voters.length ? ` <span class="avs">${voters.map((p) => avatar(p, 'sm')).join('')}</span>` : ''}</span>${rx ? `<span class="rx">${esc(rx)}</span>` : ''}${nc ? `<span class="tag">${nc} coment.</span>` : ''}${pillPendiente(i)}</div></div>`;
}

/* ---- actividad ---- */
export function textoActividad(a) {
  const OBJ = { idea: 'la oportunidad', tarea: 'la tarea', prospecto: 'el usuario de prueba', iteracion: 'la iteración' };
  const obj = OBJ[a.objeto] || a.objeto; const t = `«${esc(a.titulo || '')}»`;
  if (a.accion === 'crea') return `creó ${obj} <b>${t}</b>`;
  if (a.accion === 'borra') return `borró ${obj} <b>${t}</b>`;
  if (a.accion === 'decide') return `registró una decisión <span class="pill soft">${esc(a.detalle || 'otra')}</span> <b>${t}</b>`;
  if (a.accion === 'mueve') {
    const dest = a.objeto === 'idea' ? (STAGES.find((s) => s[0] === a.detalle) || [])[1] : a.objeto === 'tarea' ? (ESTADOS.find((s) => s[0] === a.detalle) || [])[1] : a.objeto === 'prospecto' ? etiquetaEtapaP(a.detalle) : FASES[a.detalle];
    return a.objeto === 'iteracion' ? `pasó la iteración a <b>${esc(dest || a.detalle)}</b>` : `movió ${obj} <b>${t}</b> a <b>${esc(dest || a.detalle || '')}</b>`;
  }
  return `editó ${obj} <b>${t}</b>`;
}
const modDe = { idea: 'oportunidades', tarea: 'tareas', prospecto: 'usuarios', iteracion: 'iteracion' };
export function itemActividad(a) {
  const abre = a.objeto && a.objeto !== 'iteracion' && a.accion !== 'borra' ? ` data-act="abrir" data-mod="${modDe[a.objeto]}" data-id="${esc(a.id)}"` : '';
  return `<div class="ev">${avatar(a.quien, 'sm')}<div class="txt"><b>${esc(nombre(a.quien) || '¿?')}</b> ${abre ? `<button class="lnk" type="button"${abre}>` : ''}${textoActividad(a)}${abre ? '</button>' : ''}</div><span class="when" title="${esc(fmtFechaHora(a.fecha))}">${esc(relTiempo(a.fecha))}</span></div>`;
}

/* ---- mensajes y comentarios ---- */
export function formatoMensaje(txt) {
  let h = esc(txt);
  h = h.replace(/https?:\/\/[^\s<]+/g, (u) => { const limpio = u.replace(/[),.;!?]+$/, ''); const cola = u.slice(limpio.length); return `<a href="${limpio}" target="_blank" rel="noopener">${limpio}</a>${cola}`; });
  h = h.replace(/(^|[^\w])@(pablo|max|daniel)\b/gi, (m0, pre, p) => { const k = p.toLowerCase(); return `${pre}<button type="button" class="mention${k === yo() ? ' me' : ''}" data-act="mencion" data-p="${k}" title="Ver las tareas de ${esc(nombre(k))}">@${p}</button>`; });
  return h.replace(/\n/g, '<br>');
}
export function itemMsg(m, enHilo, { compacto = false } = {}) {
  const mio = m.quien === yo();
  const ref = !enHilo && m.ref ? refInfo(m.ref.tipo, m.ref.id) : null;
  const chipRef = !enHilo && m.ref ? (ref ? `<button class="chip sm" type="button" data-act="abrir" data-mod="${ref.mod}" data-id="${esc(m.ref.id)}">${ref.etiqueta}: ${esc(m.ref.titulo)}</button>` : `<span class="tag">${esc(m.ref.titulo)} (ya no existe)</span>`) : '';
  return `<div class="msg${mio ? ' mio' : ''}${m._pendiente ? ' por-enviar' : ''}${S.resaltado && S.resaltado === m.id ? ' resaltado' : ''}" data-msg="${esc(m.id)}">${avatar(m.quien, 'sm')}<div class="cuerpo"><div class="hd"><b>${esc(nombre(m.quien) || '¿?')}</b><span class="when" title="${esc(fmtFechaHora(m.fecha))}">${m._pendiente ? 'por enviar' : esc(relTiempo(m.fecha))}</span>${chipRef}${mio && !compacto ? `<button class="lnk" type="button" data-act="del-msg" data-id="${esc(m.id)}" aria-label="Borrar mensaje">borrar</button>` : ''}</div><div class="txt">${formatoMensaje(m.texto)}</div></div></div>`;
}
export function seccionComentarios(tipo, id) {
  const hilo = comentariosDe(tipo, id);
  return `<div class="comentarios"><span class="k">Comentarios${hilo.length ? ` (${hilo.length})` : ''}</span>`
    + `<div class="hilo">${hilo.length ? hilo.map((m) => itemMsg(m, true)).join('') : '<span class="hint">Sin comentarios. Lo que escribas aquí también sale en el Chat con la referencia.</span>'}</div>`
    + `<form class="composer" data-submit="add-msg" data-ref-tipo="${tipo}" data-ref-id="${esc(id)}"><textarea class="in" data-keep="coment-${esc(id)}" rows="2" placeholder="Escribe un comentario" maxlength="1000"></textarea><button class="btn sm primary" type="submit">${icono('enviar', 'sm')}Comentar</button></form></div>`;
}
export const ligaAbrir = (u) => (ligaSegura(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">abrir ${icono('externo', 'sm')}</a>` : '');
export function pieEdicion(doc, actBorrar, id) {
  return `<span>creado ${fmtFechaHora(doc.creado)}${doc.actualizadoPor ? ` · editado por ${esc(nombre(doc.actualizadoPor))} ${relTiempo(doc.actualizado)}` : ''}</span><span>${S.guardando ? '<span class="guardado">guardando…</span>' : '<span class="guardado">' + icono('check') + ' guardado</span>'} <button class="btn quiet danger sm" type="button" data-act="${actBorrar}" data-id="${esc(id)}">${icono('borrar', 'sm')}Eliminar</button></span>`;
}
