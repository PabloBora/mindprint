/* Oportunidades: tablero por etapa, votos, criterios y reacciones. */
import { S, P, yo, ideas, ideaById, votosUsados, votosIdea, reaccCount, STAGES, CRIT, REACC, VOTOS_MAX, ORDENES, ordenar, guardarFiltros } from '../estado.js';
import { esc, icono, avatar, uid, toast, confirmar } from '../ui/base.js';
import { cardIdea, seccionComentarios, pieEdicion, colTablero, columnasGrid, selectOrden } from '../ui/piezas.js';
import { guardarIdea, borrarIdea } from '../api.js';
import { rutaDe, reemplazar } from '../ruta.js';

const f = () => S.f.oportunidades;
const coincide = (i) => { const q = (S.q || '').trim().toLowerCase(); return !q || `${i.titulo} ${i.dolor} ${i.quien} ${i.agente}`.toLowerCase().includes(q); };

function vista() {
  const todas = ideas(); const visibles = todas.filter((i) => (f().autor === 'todos' || i.autor === f().autor) && coincide(i));
  const cand = todas.filter((i) => i.etapa === 'candidata').length; const eleg = todas.filter((i) => i.etapa === 'elegida').length; const quedan = Math.max(0, VOTOS_MAX - votosUsados(yo()));
  let h = `<div class="sub"><span><b>${todas.length}</b> oportunidades</span><span><b>${cand}</b> candidata${cand === 1 ? '' : 's'}</span><span><b>${eleg}</b> elegida${eleg === 1 ? '' : 's'}</span><span class="mono">te quedan <b>${quedan}</b> de ${VOTOS_MAX} votos</span></div>`;
  h += `<div class="toolbar"><div class="chips"><button class="chip" data-act="fautor" data-v="todos" aria-pressed="${f().autor === 'todos'}">Todas</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="fautor" data-v="${p}" aria-pressed="${f().autor === p}">${avatar(p)}${esc(P()[p].nombre)}</button>`).join('')}</div>${selectOrden('oportunidades', f().orden, ORDENES.oportunidades)}<a class="btn primary sm" href="${rutaDe('oportunidades', 'nuevo')}">${icono('mas', 'sm')}Nueva oportunidad</a></div>`;
  if (!todas.length) h += '<div class="vacio"><b>Todavía no hay oportunidades.</b> Escribe la primera: con el título basta. Después abre la tarjeta para contar el dolor, quién paga y qué haría el agente, y califica los cuatro criterios. Cada quien tiene 3 votos.</div>';
  h += `<div class="stagebar chips">${STAGES.map((s) => `<button class="chip" data-act="stage" data-s="${s[0]}" aria-pressed="${f().stage === s[0]}">${s[1]} <span class="tag">${visibles.filter((i) => i.etapa === s[0]).length}</span></button>`).join('')}</div>`;
  h += `<div class="board" style="grid-template-columns:${columnasGrid(STAGES.map((e) => e[0]), f().colapsadas)}">`;
  for (const [k, label] of STAGES) {
    const items = ordenar('oportunidades', visibles.filter((i) => i.etapa === k), f().orden);
    h += colTablero({ tablero: 'oportunidades', kind: 'idea', k, label, total: items.length, cards: items.map(cardIdea).join(''), activa: f().stage === k, plegada: f().colapsadas.includes(k), hl: k === 'elegida' });
  }
  h += '</div>';
  return h;
}

function panel(id) {
  if (id === 'nuevo') {
    return { titulo: 'Nueva oportunidad', html: `<form data-submit="add-idea" class="panel-mod">
      <div class="field"><label>Qué proceso repetitivo automatizaríamos</label><input class="in" name="titulo" data-keep="idea-new" placeholder="Una oportunidad en una frase" maxlength="140" autocomplete="off" required></div>
      <div class="field"><label>El dolor, en una frase</label><textarea class="in" name="dolor" rows="2" placeholder="Qué duele hoy y a quién"></textarea></div>
      <div class="field"><label>Quién lo sufre o quién paga</label><textarea class="in" name="quien" rows="1"></textarea></div>
      <div class="field"><label>Qué haría el agente</label><textarea class="in" name="agente" rows="2"></textarea></div>
      <div><button class="btn primary" type="submit">Crear oportunidad</button></div></form>` };
  }
  const i = ideaById(id); if (!i) return null;
  const c = i.criterios || {}; const v = i.votos || {}; const r = i.reacciones || {}; const me = yo();
  const mine = v[me] || 0; const quedan = Math.max(0, VOTOS_MAX - votosUsados(me));
  const B = (cmp) => `data-bind="ideas:${esc(i.id)}:${cmp}"`;
  const voters = Object.keys(P()).filter((p) => v[p]); const rc = reaccCount(i); const rxs = REACC.filter((x) => rc[x[0]]).map((x) => `${x[1]} ${rc[x[0]]}`).join(' · ');
  const html = `<div class="fila-etapas"><div class="seg multi">${STAGES.map((s) => `<button type="button" data-act="etapa" data-id="${esc(i.id)}" data-s="${s[0]}" aria-pressed="${i.etapa === s[0]}">${s[1]}</button>`).join('')}</div></div>
    <input class="titulo" ${B('titulo')} value="${esc(i.titulo)}" maxlength="140" aria-label="Título">
    <div class="field"><label>El dolor, en una frase</label><textarea class="in" rows="2" ${B('dolor')} placeholder="Qué duele hoy y a quién">${esc(i.dolor)}</textarea></div>
    <div class="field"><label>Quién lo sufre o quién paga</label><textarea class="in" rows="1" ${B('quien')} placeholder="Rol, tipo de empresa, gente concreta si la hay">${esc(i.quien)}</textarea></div>
    <div class="field"><label>Qué haría el agente</label><textarea class="in" rows="2" ${B('agente')} placeholder="Lee, propone, ejecuta… hasta dónde llega">${esc(i.agente)}</textarea></div>
    <div class="field"><label>Cómo sabríamos que vale</label><textarea class="in" rows="2" ${B('validacion')} placeholder="La señal que nos haría seguir">${esc(i.validacion)}</textarea></div>
    <div class="lado">
      <div class="field"><label>Quién la propone</label><select class="in" ${B('autor')}><option value="">—</option>${Object.keys(P()).map((p) => `<option value="${p}"${i.autor === p ? ' selected' : ''}>${esc(P()[p].nombre)}</option>`).join('')}</select></div>
      <div class="field"><label>Tus votos en esta oportunidad</label><div class="votebox"><button class="btn sm" type="button" data-act="voto" data-id="${esc(i.id)}" data-d="-1"${mine <= 0 ? ' disabled' : ''}>−</button><span class="num">${mine}</span><button class="btn sm" type="button" data-act="voto" data-id="${esc(i.id)}" data-d="1"${quedan <= 0 ? ' disabled' : ''}>+</button><span class="tag">te quedan ${quedan} · total ${votosIdea(i)}</span></div><div class="voters">${voters.length ? voters.map((p) => `<span>${avatar(p, 'sm')}${esc(P()[p].nombre)} ${v[p]}</span>`).join('') : '<span class="tag">nadie ha votado</span>'}</div></div>
      <div class="field"><label>Criterios</label>${CRIT.map((k) => `<div class="critrow"><span>${k[1]}</span><div class="seg l2">${[['0', 'no', ''], ['1', 'algo', 'w'], ['2', 'sí', 'g']].map((o) => `<button type="button" class="${o[2]}" data-act="crit" data-id="${esc(i.id)}" data-k="${k[0]}" data-v="${o[0]}" aria-pressed="${String(c[k[0]] || 0) === o[0]}">${o[1]}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="field"><label>Tu reacción</label><div class="chips">${REACC.map((x) => `<button type="button" class="chip" data-act="reacc" data-id="${esc(i.id)}" data-r="${x[0]}" aria-pressed="${r[me] === x[0]}">${x[1]}</button>`).join('')}</div>${rxs ? `<span class="tag">${esc(rxs)}</span>` : ''}</div>
    </div>
    <div class="field"><label>Notas</label><textarea class="in" rows="2" ${B('notas')}>${esc(i.notas)}</textarea></div>
    ${seccionComentarios('idea', i.id)}`;
  return { titulo: `Oportunidad<span class="sr-only">: ${esc(i.titulo)}</span>`, html, pie: pieEdicion(i, 'del-idea', i.id) };
}

export default {
  id: 'oportunidades', titulo: 'Oportunidades', corto: 'Oportunidades', icono: 'oportunidades', orden: 4, principal: false, nuevo: true,
  badge: () => (ideas().length ? String(ideas().length) : ''),
  vista, panel,
  filtros: (k, v) => { if (k === 'orden') { f().orden = v; guardarFiltros(); } },
  acciones: {
    'fautor': (el) => { f().autor = el.dataset.v; guardarFiltros(); S.render(); },
    'stage': (el) => { f().stage = el.dataset.s; guardarFiltros(); S.render(); },
    'etapa': async (el) => { const i = ideaById(el.dataset.id); if (i && i.etapa !== el.dataset.s) await guardarIdea({ ...i, etapa: el.dataset.s }); },
    'voto': async (el) => { const i = ideaById(el.dataset.id); if (!i) return; const d = parseInt(el.dataset.d, 10); const me = yo(); const v = { ...(i.votos || {}) }; const cur = v[me] || 0; if (d > 0 && votosUsados(me) >= VOTOS_MAX) { toast(`Ya usaste tus ${VOTOS_MAX} votos`); return; } v[me] = Math.max(0, cur + d); await guardarIdea({ ...i, votos: v }); },
    'crit': async (el) => { const i = ideaById(el.dataset.id); if (!i) return; await guardarIdea({ ...i, criterios: { ...(i.criterios || {}), [el.dataset.k]: parseInt(el.dataset.v, 10) } }); },
    'reacc': async (el) => { const i = ideaById(el.dataset.id); if (!i) return; const me = yo(); const r = { ...(i.reacciones || {}) }; r[me] = r[me] === el.dataset.r ? '' : el.dataset.r; await guardarIdea({ ...i, reacciones: r }); },
    'del-idea': async (el) => { const i = ideaById(el.dataset.id); if (!i) return; if (!(await confirmar({ titulo: 'Eliminar oportunidad', texto: `«${i.titulo}» se borra para los tres.`, ok: 'Eliminar', peligro: true }))) return; const copia = { ...i }; reemplazar(rutaDe('oportunidades')); if (await borrarIdea(i.id)) toast('Oportunidad eliminada', { accion: 'Deshacer', onAccion: () => guardarIdea(copia), ms: 6000 }); },
  },
  binds: { ideas: async (id, campo, val) => { const i = ideaById(id); if (!i || i[campo] === val) return; await guardarIdea({ ...i, [campo]: val }); } },
  submits: {
    'add-idea': async (form) => {
      const d = Object.fromEntries(new FormData(form).entries()); const titulo = (d.titulo || '').trim(); if (!titulo) return;
      const ok = await guardarIdea({ id: uid(), titulo, dolor: d.dolor || '', quien: d.quien || '', agente: d.agente || '', validacion: '', notas: '', autor: yo(), etapa: 'semilla', votos: {}, criterios: {}, reacciones: {} });
      if (ok) { f().stage = 'semilla'; reemplazar(rutaDe('oportunidades')); toast('Oportunidad agregada en Detectada'); }
    },
  },
};
