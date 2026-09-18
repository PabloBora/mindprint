/* Hoy: el centro de trabajo. */
import { S, P, yo, nombre, tareas, prospectos, ideas, iteracion, actividad, mensajes, noLeidos, mencionesSinLeer, esMia, ordenTareas, ordenProspectos, enJuego, PHASES, FASES, ARTEF, semanasDe, guardarFiltros } from '../estado.js';
import { esc, avatar, fmtDia, diasHasta, semanaDe, diaDe, hoy, uid } from '../ui/base.js';
import { itemTarea, itemProspecto, itemActividad, itemMsg, pillEstado, pillVence, ligaAbrir } from '../ui/piezas.js';
import { rutaDe, ir } from '../ruta.js';
import { guardarTarea } from '../api.js';

/* «Mi día»: lo mío agrupado por cuándo vence. */
export const GRUPOS_MIOS = [['vencidas', 'Vencidas'], ['hoy', 'Para hoy'], ['semana', 'Esta semana'], ['luego', 'Más adelante'], ['sin', 'Sin fecha']];
export function grupoDe(t) { if (!t.vence) return 'sin'; const d = diasHasta(t.vence); if (d < 0) return 'vencidas'; if (d === 0) return 'hoy'; if (d <= 7) return 'semana'; return 'luego'; }
const TOPE_MIOS = 10;
function loMio(mias) {
  if (!mias.length) return '<div class="hint">Nada pendiente a tu nombre ni de los tres. Agrega arriba o toma algo del tablero de Tareas.</div>';
  let h = ''; let puestos = 0;
  for (const [k, n] of GRUPOS_MIOS) {
    const del = mias.filter((t) => grupoDe(t) === k); if (!del.length) continue;
    // lo urgente (vencidas, hoy, esta semana) siempre se ve completo; lo demás hasta el tope
    const cupo = ['vencidas', 'hoy', 'semana'].includes(k) ? del.length : Math.max(0, TOPE_MIOS - puestos);
    if (!cupo) continue;
    h += `<div class="grupo-t ${k}"><span>${n}</span><span class="n">${del.length}</span></div>${del.slice(0, cupo).map(itemTarea).join('')}`;
    puestos += Math.min(cupo, del.length);
  }
  const resto = mias.length - puestos;
  return h + (resto > 0 ? `<button type="button" class="btn quiet sm more" data-act="ver-mias">y ${resto} más en Tareas</button>` : '');
}
function cajaChat() {
  const ms = mensajes(); const nl = noLeidos(); const nm = mencionesSinLeer();
  const cab = nl ? `${nl} sin leer${nm ? ` · ${nm} te mencion${nm === 1 ? 'a' : 'an'}` : ''}` : 'al día';
  return `<section class="box caja-chat"><h2>Chat <span class="n${nl ? ' hot' : ''}">${cab}</span></h2>`
    + (ms.length ? `<div class="chat-mini">${ms.slice(-3).map((m) => itemMsg(m, false, { compacto: true })).join('')}</div>` : '<div class="hint">Todavía nadie escribe. Lo que platiquen los tres, y los comentarios en tarjetas, aparece aquí.</div>')
    + `<a class="btn quiet sm more" href="${rutaDe('chat')}">${nl ? 'Leer en el chat' : 'Ir al chat'}</a></section>`;
}

function vista() {
  const it = iteracion(); const me = yo();
  const idx = PHASES.findIndex((p) => p[0] === it.fase); const sem = semanaDe(it.inicio); const dDemo = diasHasta(it.demo);
  const faltan = [!it.inicio && 'fecha de inicio', !it.demo && 'fecha de prueba', !it.sincronia && 'sincronía', !it.canal && 'canal'].filter(Boolean);
  const SEM = semanasDe(it); const pct = sem == null ? 0 : Math.min(100, Math.round((sem / SEM) * 100));
  const mias = tareas().filter((t) => esMia(t) && t.estado !== 'hecha').sort(ordenTareas);
  const hechosArt = ARTEF.filter((a) => ((it.artefactos || {})[a[0]] || {}).hecho).length;
  const hechasHoy = tareas().filter((t) => esMia(t) && t.estado === 'hecha' && diaDe(t.actualizado) === hoy()).length;
  let h = `<section class="hero"><div class="top-line"><h2>Iteración ${esc(it.numero || 1)} · <span class="fase">${esc(FASES[it.fase] || it.fase)}</span></h2><div class="facts">`
    + (sem != null ? `<span>semana <b>${sem}</b> de ${SEM}</span>` : '')
    + (dDemo == null ? '' : `<span>${dDemo < 0 ? `prueba hace <b>${-dDemo} d</b>` : dDemo === 0 ? 'prueba <b>hoy</b>' : `prueba en <b>${dDemo} d</b> (${fmtDia(it.demo)})`}</span>`)
    + (it.sincronia ? `<span>sincronía <b>${esc(it.sincronia)}</b></span>` : '') + (it.canal ? `<span>canal <b>${esc(it.canal)}</b></span>` : '')
    + '</div></div>'
    + (faltan.length ? `<a class="completar" href="${rutaDe('iteracion')}">Falta${faltan.length > 1 ? 'n' : ''} ${faltan.join(', ')} · completar</a>` : '')
    + `<div class="bar"><i style="width:${pct}%"></i></div>`
    + `<div class="mini-steps">${PHASES.map((p, i) => `<a href="${rutaDe('iteracion')}" class="${i < idx ? 'done' : ''}${i === idx ? 'now' : ''}" title="Ir a Iteración">${p[1]}</a>`).join('')}</div></section>`;
  const cajas = {};
  cajas.mio = `<section class="box caja-mio"><h2>Lo mío <span class="n">${mias.length} abierta${mias.length === 1 ? '' : 's'}${hechasHoy ? ` · ${hechasHoy} hecha${hechasHoy === 1 ? '' : 's'} hoy` : ''}</span></h2>`
    + '<form class="quick" data-submit="add-mia"><input class="in" id="mia-new" data-keep="mia-new" placeholder="Algo que tienes que hacer" maxlength="160" autocomplete="off" required><input class="in" type="date" id="mia-vence" aria-label="Vence"><button class="btn primary" type="submit">Agregar</button></form>'
    + `<div class="lista">${loMio(mias)}</div>`
    + `<a class="btn quiet sm more" href="${rutaDe('tareas')}">Ver el tablero de tareas</a></section>`;
  cajas.chat = cajaChat();
  const lista = prospectos().filter(enJuego).sort(ordenProspectos);
  cajas.usuarios = `<section class="box caja-usuarios"><h2>Usuarios de prueba <span class="n">${lista.length} en juego</span></h2><div class="lista">${lista.length ? lista.slice(0, 6).map(itemProspecto).join('') : '<div class="hint">Sin usuarios de prueba. Elige gente cercana con la que puedan validar sin fricción y agrégala en su pestaña.</div>'}</div><a class="btn quiet sm more" href="${rutaDe('usuarios')}">Ver usuarios de prueba</a></section>`;
  const otros = Object.keys(P()).filter((p) => p !== me); const otrosEnLinea = otros.filter((p) => S.enLinea.includes(p)).length;
  cajas.equipo = `<section class="box caja-equipo"><h2>El equipo <span class="n">${otrosEnLinea === 0 ? 'nadie más en línea' : `${otrosEnLinea} en línea`}</span></h2><div>${otros.map((p) => {
    const suyas = tareas().filter((t) => t.responsable === p && t.estado !== 'hecha').sort(ordenTareas);
    const l = [...suyas.filter((t) => t.estado === 'en_curso'), ...suyas.filter((t) => t.estado === 'bloqueada'), ...suyas.filter((t) => t.estado === 'pendiente')].slice(0, 4);
    return `<div class="persona-row">${avatar(p, S.enLinea.includes(p) ? '' : 'off')}<div><div class="nom">${esc(nombre(p))}<span class="tag">${esc(P()[p].rol)}</span>${S.enLinea.includes(p) ? '<span class="pill ok">en línea</span>' : ''}</div>${l.length ? `<ul>${l.map((t) => `<li><button class="tit lnk" type="button" data-act="abrir" data-mod="tareas" data-id="${esc(t.id)}">${esc(t.titulo)}</button> ${pillEstado(t)}${pillVence(t)}</li>`).join('')}${suyas.length > 4 ? `<li class="tag">y ${suyas.length - 4} más</li>` : ''}</ul>` : '<div class="hint">sin tareas abiertas</div>'}</div></div>`;
  }).join('')}</div></section>`;
  const artFase = ARTEF.filter((a) => a[2] === it.fase); const cand = ideas().filter((i) => i.etapa === 'candidata').length; const eleg = ideas().filter((i) => i.etapa === 'elegida').length; const bloqueadas = tareas().filter((t) => t.estado === 'bloqueada');
  cajas.fase = `<section class="box caja-fase"><h2>Pendiente de la fase <span class="n">${esc(FASES[it.fase] || it.fase)}</span></h2>`
    + `<a class="progreso-art" href="${rutaDe('iteracion')}"><span><b>${hechosArt}</b> de ${ARTEF.length} entregables de la iteración</span><span class="bar"><i style="width:${Math.round((hechosArt / ARTEF.length) * 100)}%"></i></span></a><div class="lista">`
    + (artFase.length ? artFase.map((a) => { const x = (it.artefactos || {})[a[0]] || {}; return `<div class="item-t${x.hecho ? ' hecha' : ''}"><span class="check${x.hecho ? ' on' : ''}" aria-hidden="true">✓</span><div><a class="tit" href="${rutaDe('iteracion')}">${esc(a[1])}</a><div class="tags">${x.hecho ? '<span class="pill ok">hecho</span>' : '<span class="tag">entregable de la fase</span>'}${ligaAbrir(x.liga)}</div></div></div>`; }).join('') : '<div class="hint">Esta fase no tiene entregable propio.</div>')
    + `<div class="item-t"><span class="check${eleg ? ' on' : ''}" aria-hidden="true">✓</span><div><a class="tit" href="${rutaDe('oportunidades')}">Oportunidades: ${cand} candidata${cand === 1 ? '' : 's'}, ${eleg} elegida${eleg === 1 ? '' : 's'}</a><div class="tags"><span class="tag">${ideas().length} en total</span></div></div></div>`
    + (bloqueadas.length ? `<div class="item-t"><span class="check alert" aria-hidden="true">!</span><div><a class="tit" href="${rutaDe('tareas')}">${bloqueadas.length} tarea${bloqueadas.length === 1 ? '' : 's'} bloqueada${bloqueadas.length === 1 ? '' : 's'}</a><div class="tags">${bloqueadas.slice(0, 3).map((t) => `<span class="pill bad">${esc(t.titulo)}</span>`).join('')}</div></div></div>` : '')
    + '</div></section>';
  const acts = actividad().slice(0, 8);
  cajas.movs = `<section class="box caja-movs"><h2>Últimos movimientos</h2><div class="feed compact">${acts.length ? acts.map(itemActividad).join('') : '<div class="hint">Aún no pasa nada. Lo que hagan los tres queda aquí.</div>'}</div><a class="btn quiet sm more" href="${rutaDe('actividad')}">Ver toda la actividad</a></section>`;
  h += `<div class="grid-hoy"><div class="col-hoy">${cajas.mio}${cajas.fase}</div><div class="col-hoy">${cajas.chat}${cajas.usuarios}${cajas.equipo}${cajas.movs}</div></div>`;
  return h;
}

export default {
  id: 'hoy', titulo: 'Hoy', icono: 'hoy', orden: 1, principal: true,
  vista,
  acciones: {
    'ver-mias': () => { S.f.tareas.resp = 'mias'; S.f.tareas.col = 'pendiente'; guardarFiltros(); ir(rutaDe('tareas')); },
  },
  submits: {
    'add-mia': async (f) => {
      const inp = f.querySelector('#mia-new'); const t = inp.value.trim(); if (!t) return;
      const ok = await guardarTarea({ id: uid(), titulo: t, detalle: '', motivo: '', responsable: yo(), fase: iteracion().fase, estado: 'pendiente', vence: (f.querySelector('#mia-vence') || {}).value || '', ideaId: '' });
      if (ok) { const i2 = document.getElementById('mia-new'); if (i2) i2.value = ''; }
    },
  },
};
