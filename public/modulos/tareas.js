/* Tareas: tablero por estado, panel de edición y alta. */
import { S, yo, tareas, ideas, iteracion, tareaById, esMia, ordenTareas, RESP, FASES, ESTADOS, lsSet } from '../estado.js';
import { esc, icono, avatar, uid, toast, confirmar } from '../ui/base.js';
import { cardTarea, seccionComentarios, pieEdicion } from '../ui/piezas.js';
import { guardarTarea, borrarTarea } from '../api.js';
import { rutaDe, reemplazar } from '../ruta.js';

const f = () => S.f.tareas;
const coincide = (t) => { const q = (S.q || '').trim().toLowerCase(); return !q || `${t.titulo} ${t.detalle} ${t.motivo}`.toLowerCase().includes(q); };
const opcionesIdea = (sel) => `<option value="">—</option>${ideas().slice().sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))).map((i) => `<option value="${esc(i.id)}"${sel === i.id ? ' selected' : ''}>${esc(i.titulo)}</option>`).join('')}`;

function vista() {
  let list = tareas().filter(coincide);
  if (f().resp === 'mias') list = list.filter(esMia); else if (f().resp !== 'todas') list = list.filter((t) => t.responsable === f().resp || t.responsable === 'todos');
  if (f().fase !== 'todas') list = list.filter((t) => t.fase === f().fase);
  let h = `<div class="toolbar"><div class="chips"><button class="chip" data-act="ftareas" data-v="todas" aria-pressed="${f().resp === 'todas'}">Todas</button><button class="chip" data-act="ftareas" data-v="mias" aria-pressed="${f().resp === 'mias'}">Mías</button>${Object.keys(RESP).filter((k) => k !== 'todos').map((p) => `<button class="chip" data-act="ftareas" data-v="${p}" aria-pressed="${f().resp === p}">${avatar(p)}${esc(RESP[p])}</button>`).join('')}</div>`
    + `<select class="in" data-filtro="fase" aria-label="Fase" style="width:auto"><option value="todas"${f().fase === 'todas' ? ' selected' : ''}>Todas las fases</option>${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${f().fase === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`
    + `<a class="btn primary sm" href="${rutaDe('tareas', 'nuevo')}">${icono('mas', 'sm')}Nueva tarea</a></div>`;
  if (!tareas().length) h += '<div class="vacio"><b>Sin tareas todavía.</b> Anota lo que alguien tiene que hacer, con responsable y fecha si la hay. <span class="solo-escritorio">Arrastra las tarjetas entre columnas conforme avancen.</span><span class="solo-movil">Cámbialas de columna con el botón de flechas de cada tarjeta.</span></div>';
  h += `<div class="stagebar chips">${ESTADOS.map((s) => `<button class="chip" data-act="colt" data-v="${s[0]}" aria-pressed="${f().col === s[0]}">${s[1]} <span class="tag">${list.filter((t) => t.estado === s[0]).length}</span></button>`).join('')}</div>`;
  h += '<div class="board t4">';
  for (const [k, label] of ESTADOS) {
    let items = list.filter((t) => t.estado === k);
    items = k === 'hecha' ? items.sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || ''))) : items.sort(ordenTareas);
    const total = items.length; const cap = 12; if (k === 'hecha' && !f().verHechas && items.length > cap) items = items.slice(0, cap);
    h += `<section class="col${f().col === k ? ' active' : ''}${items.length ? '' : ' empty'}" data-col="${k}" data-kind="tarea"><h3><span>${label}</span><span class="n">${total}</span></h3><div class="cards">${items.map(cardTarea).join('')}</div>${k === 'hecha' && total > cap ? `<button class="btn quiet sm" type="button" data-act="verhechas">${f().verHechas ? 'Ver menos' : `Ver las ${total}`}</button>` : ''}</section>`;
  }
  h += '</div>';
  return h;
}

function panel(id) {
  if (id === 'nuevo') {
    const it = iteracion(); const me = yo();
    return { titulo: 'Nueva tarea', html: `<form data-submit="add-tarea" class="panel-mod">
      <div class="field"><label>Qué hay que hacer</label><input class="in" name="titulo" data-keep="tarea-new" placeholder="Una tarea en una frase" maxlength="160" autocomplete="off" required></div>
      <div class="field"><label>Detalle o liga</label><textarea class="in" name="detalle" rows="2" placeholder="Contexto, liga al Doc, lo que haga falta"></textarea></div>
      <div class="datos"><div class="field"><label>Responsable</label><select class="in" name="responsable">${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${k === me ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Fase</label><select class="in" name="fase">${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${it.fase === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Vence</label><input class="in" type="date" name="vence"></div>
      <div class="field"><label>Oportunidad relacionada</label><select class="in" name="ideaId">${opcionesIdea('')}</select></div></div>
      <div><button class="btn primary" type="submit">Crear tarea</button></div></form>` };
  }
  const t = tareaById(id); if (!t) return null;
  const B = (c) => `data-bind="tareas:${esc(t.id)}:${c}"`;
  const html = `<div class="fila-etapas"><div class="seg multi">${ESTADOS.map((s) => `<button type="button" data-act="estado-t" data-id="${esc(t.id)}" data-s="${s[0]}" aria-pressed="${t.estado === s[0]}">${s[1]}</button>`).join('')}</div></div>
    <input class="titulo" ${B('titulo')} value="${esc(t.titulo)}" maxlength="160" aria-label="Título">
    <div class="field"><label>Detalle o liga</label><textarea class="in" rows="3" ${B('detalle')} placeholder="Contexto, liga al Doc, lo que haga falta para hacerla">${esc(t.detalle)}</textarea></div>
    ${t.estado === 'bloqueada' ? `<div class="field"><label>Bloqueada por</label><input class="in" ${B('motivo')} value="${esc(t.motivo)}" placeholder="Qué falta o quién la destraba"></div>` : ''}
    <div class="lado"><div class="datos">
      <div class="field"><label>Responsable</label><select class="in" ${B('responsable')}>${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${t.responsable === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Fase</label><select class="in" ${B('fase')}>${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${t.fase === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Vence</label><input class="in" type="date" ${B('vence')} value="${esc(t.vence)}"></div>
      <div class="field"><label>Oportunidad relacionada</label><select class="in" ${B('ideaId')}>${opcionesIdea(t.ideaId)}</select></div>
    </div></div>
    ${seccionComentarios('tarea', t.id)}`;
  return { titulo: `Tarea<span class="sr-only">: ${esc(t.titulo)}</span>`, html, pie: pieEdicion(t, 'del-tarea', t.id) };
}

export default {
  id: 'tareas', titulo: 'Tareas', icono: 'tareas', orden: 2, principal: true, nuevo: true,
  badge: () => { const n = tareas().filter((t) => esMia(t) && t.estado !== 'hecha').length; return n ? String(n) : ''; },
  hot: () => { const h = new Date().toISOString().slice(0, 10); return tareas().some((t) => esMia(t) && t.estado !== 'hecha' && t.vence && t.vence < h); },
  vista, panel,
  filtros: (k, v) => { if (k === 'fase') f().fase = v; },
  acciones: {
    'ftareas': (el) => { f().resp = el.dataset.v; lsSet('mp.f.tareas.resp', f().resp); S.render(); },
    'colt': (el) => { f().col = el.dataset.v; S.render(); },
    'verhechas': () => { f().verHechas = !f().verHechas; S.render(); },
    'hecha': async (el) => { const t = tareaById(el.dataset.id); if (t) await guardarTarea({ ...t, estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' }); },
    'estado-t': async (el) => { const t = tareaById(el.dataset.id); if (t && t.estado !== el.dataset.s) await guardarTarea({ ...t, estado: el.dataset.s }); },
    'del-tarea': async (el) => { const t = tareaById(el.dataset.id); if (!t) return; if (!(await confirmar({ titulo: 'Eliminar tarea', texto: `«${t.titulo}» se borra para los tres.`, ok: 'Eliminar', peligro: true }))) return; const copia = { ...t }; reemplazar(rutaDe('tareas')); if (await borrarTarea(t.id)) toast('Tarea eliminada', { accion: 'Deshacer', onAccion: () => guardarTarea(copia), ms: 6000 }); },
  },
  binds: { tareas: async (id, campo, val) => { const t = tareaById(id); if (!t || t[campo] === val) return; await guardarTarea({ ...t, [campo]: val }); } },
  submits: {
    'add-tarea': async (form) => {
      const d = Object.fromEntries(new FormData(form).entries()); const titulo = (d.titulo || '').trim(); if (!titulo) return;
      const ok = await guardarTarea({ id: uid(), titulo, detalle: d.detalle || '', motivo: '', responsable: d.responsable, fase: d.fase, estado: 'pendiente', vence: d.vence || '', ideaId: d.ideaId || '' });
      if (ok) { reemplazar(rutaDe('tareas')); toast('Tarea creada'); }
    },
  },
};
