/* Búsqueda global sobre el estado en memoria: tareas, usuarios de prueba, oportunidades y mensajes. Pura, sin DOM. */
import { tareas, prospectos, ideas, mensajes, nombre, RESP, FASES, ESTADOS, ETAPAS_P, STAGES, refInfo } from './estado.js';
import { fmtFechaHora } from './ui/base.js';

export const GRUPOS = [
  { k: 'tareas', titulo: 'Tareas', icono: 'tareas' },
  { k: 'usuarios', titulo: 'Usuarios de prueba', icono: 'usuarios' },
  { k: 'oportunidades', titulo: 'Oportunidades', icono: 'oportunidades' },
  { k: 'mensajes', titulo: 'Mensajes y comentarios', icono: 'chat' },
];
const etiqueta = (lista, k) => (lista.find((x) => x[0] === k) || [])[1] || k;
export const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** 3 = el texto principal empieza con la consulta; 2 = la contiene; 1 = aparece en un campo secundario; 0 = no coincide. */
export function puntaje(q, campos) {
  const t = normalizar(campos[0]); if (t.startsWith(q)) return 3; if (t.includes(q)) return 2;
  for (const c of campos.slice(1)) if (normalizar(c).includes(q)) return 1;
  return 0;
}
function grupo(lista, campos, mapa, max) {
  const r = [];
  for (const x of lista) { const p = puntaje(grupo.q, campos(x)); if (p) r.push({ p, ...mapa(x) }); }
  r.sort((a, b) => b.p - a.p);
  return { total: r.length, items: r.slice(0, max) };
}
/** null si la consulta es muy corta; si no, {tareas, usuarios, oportunidades, mensajes} con {total, items:[{mod,id,titulo,sub}]}. */
export function buscarGlobal(q, { max = 5 } = {}) {
  grupo.q = normalizar(q).trim(); if (grupo.q.length < 2) return null;
  return {
    tareas: grupo(tareas(), (t) => [t.titulo, t.detalle, t.motivo], (t) => ({ mod: 'tareas', id: t.id, titulo: t.titulo, sub: `${etiqueta(ESTADOS, t.estado)} · ${RESP[t.responsable] || ''}${t.fase !== 'general' ? ` · ${FASES[t.fase] || ''}` : ''}` }), max),
    usuarios: grupo(prospectos(), (p) => [p.empresa, p.contacto, p.relacion, p.area, p.siguientePaso, p.notas], (p) => ({ mod: 'usuarios', id: p.id, titulo: p.empresa, sub: [etiqueta(ETAPAS_P, p.etapa), p.contacto, p.relacion].filter(Boolean).join(' · ') }), max),
    oportunidades: grupo(ideas(), (i) => [i.titulo, i.dolor, i.quien, i.agente, i.notas], (i) => ({ mod: 'oportunidades', id: i.id, titulo: i.titulo || '(sin título)', sub: `${etiqueta(STAGES, i.etapa)}${i.dolor ? ` · ${i.dolor.slice(0, 70)}` : ''}` }), max),
    mensajes: grupo(mensajes(), (m) => [m.texto], (m) => {
      const ref = m.ref ? refInfo(m.ref.tipo, m.ref.id) : null;
      return { mod: ref ? ref.mod : 'chat', id: ref ? m.ref.id : m.id, titulo: m.texto.length > 90 ? `${m.texto.slice(0, 90)}…` : m.texto, sub: `${nombre(m.quien) || '¿?'} · ${fmtFechaHora(m.fecha)}${ref ? ` · en ${ref.etiqueta} «${ref.titulo}»` : ''}` };
    }, max),
  };
}
