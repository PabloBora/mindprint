/* Actividad: todo lo que pasó, por día, filtrable por persona y por tipo (los filtros se recuerdan). */
import { S, P, actividad, guardarFiltros } from '../estado.js';
import { esc, avatar, diaDe, etiquetaDia } from '../ui/base.js';
import { itemActividad } from '../ui/piezas.js';

export const TIPOS_ACT = [['todo', 'Todo'], ['tarea', 'Tareas'], ['prospecto', 'Usuarios de prueba'], ['idea', 'Oportunidades'], ['iteracion', 'Iteración']];
const f = () => S.f.actividad;
export const filtrarActividad = (items, { quien = 'todos', tipo = 'todo' } = {}) => items.filter((a) => (quien === 'todos' || a.quien === quien) && (tipo === 'todo' || a.objeto === tipo));

function vista() {
  const todos = actividad();
  if (!todos.length) return '<div class="vacio"><b>Aún no pasa nada.</b> Aquí queda quién creó, movió o decidió qué, para no perder el hilo entre sesiones.</div>';
  let h = `<div class="toolbar"><div class="chips"><button class="chip" data-act="fact-quien" data-v="todos" aria-pressed="${f().quien === 'todos'}">Los tres</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="fact-quien" data-v="${p}" aria-pressed="${f().quien === p}">${avatar(p)}${esc(P()[p].nombre)}</button>`).join('')}</div>`
    + `<div class="chips">${TIPOS_ACT.map(([k, n]) => `<button class="chip" data-act="fact-tipo" data-v="${k}" aria-pressed="${f().tipo === k}">${n}</button>`).join('')}</div></div>`;
  const items = filtrarActividad(todos, f());
  if (!items.length) return `${h}<div class="vacio"><b>Nada con estos filtros.</b> Prueba con «Los tres» o «Todo».</div>`;
  h += '<div class="feed">'; let dia = '';
  for (const a of items) { const d = diaDe(a.fecha); if (d !== dia) { dia = d; h += `<div class="day">${esc(etiquetaDia(d))}</div>`; } h += itemActividad(a); }
  return `${h}</div>`;
}
export default {
  id: 'actividad', titulo: 'Actividad', icono: 'actividad', orden: 7, principal: false, vista,
  acciones: {
    'fact-quien': (el) => { f().quien = el.dataset.v; guardarFiltros(); S.render(); },
    'fact-tipo': (el) => { f().tipo = el.dataset.v; guardarFiltros(); S.render(); },
  },
};
