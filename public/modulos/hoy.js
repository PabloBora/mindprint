/* Hoy: el centro de trabajo. */
import { S, P, yo, nombre, tareas, prospectos, ideas, iteracion, actividad, esMia, ordenTareas, ordenProspectos, enJuego, PHASES, FASES, ARTEF, semanasDe } from '../estado.js';
import { esc, avatar, fmtDia, diasHasta, semanaDe, diaDe, hoy, uid } from '../ui/base.js';
import { itemTarea, itemProspecto, itemActividad, pillEstado, pillVence, ligaAbrir } from '../ui/piezas.js';
import { rutaDe } from '../ruta.js';
import { guardarTarea } from '../api.js';

function vista() {
  const it = iteracion(); const me = yo();
  const idx = PHASES.findIndex((p) => p[0] === it.fase); const sem = semanaDe(it.inicio); const dDemo = diasHasta(it.demo);
  const SEM = semanasDe(it); const pct = sem == null ? 0 : Math.min(100, Math.round((sem / SEM) * 100));
  const mias = tareas().filter((t) => esMia(t) && t.estado !== 'hecha').sort(ordenTareas);
  const hechasHoy = tareas().filter((t) => esMia(t) && t.estado === 'hecha' && diaDe(t.actualizado) === hoy()).length;
  let h = `<section class="hero"><div class="top-line"><h2>Iteración ${esc(it.numero || 1)} · <span class="fase">${esc(FASES[it.fase] || it.fase)}</span></h2><div class="facts">`
    + `<span>${sem != null ? `semana <b>${sem}</b> de ${SEM}` : '<b>sin fecha de inicio</b>'}</span>`
    + `<span>${dDemo == null ? 'prueba <b>sin fecha</b>' : dDemo < 0 ? `prueba hace <b>${-dDemo} d</b>` : dDemo === 0 ? 'prueba <b>hoy</b>' : `prueba en <b>${dDemo} d</b> (${fmtDia(it.demo)})`}</span>`
    + `<span>sincronía <b>${esc(it.sincronia || 'por definir')}</b></span><span>canal <b>${esc(it.canal || 'por definir')}</b></span></div></div>`
    + `<div class="bar"><i style="width:${pct}%"></i></div>`
    + `<div class="mini-steps">${PHASES.map((p, i) => `<a href="${rutaDe('iteracion')}" class="${i < idx ? 'done' : ''}${i === idx ? 'now' : ''}" title="Ir a Iteración">${p[1]}</a>`).join('')}</div></section>`;
  h += '<div class="grid-hoy">';
  h += `<section class="box"><h2>Lo mío <span class="n">${mias.length} abierta${mias.length === 1 ? '' : 's'}${hechasHoy ? ` · ${hechasHoy} hecha${hechasHoy === 1 ? '' : 's'} hoy` : ''}</span></h2>`
    + '<form class="quick" data-submit="add-mia"><input class="in" id="mia-new" data-keep="mia-new" placeholder="Algo que tienes que hacer" maxlength="160" autocomplete="off" required><input class="in" type="date" id="mia-vence" aria-label="Vence"><button class="btn primary" type="submit">Agregar</button></form>'
    + `<div class="lista">${mias.length ? mias.map(itemTarea).join('') : '<div class="hint">Nada pendiente a tu nombre ni de los tres. Agrega arriba o toma algo del tablero de Tareas.</div>'}</div>`
    + `<a class="btn quiet sm more" href="${rutaDe('tareas')}">Ver el tablero de tareas</a></section>`;
  const lista = prospectos().filter(enJuego).sort(ordenProspectos);
  h += `<section class="box"><h2>Usuarios de prueba <span class="n">${lista.length} en juego</span></h2><div class="lista">${lista.length ? lista.slice(0, 6).map(itemProspecto).join('') : '<div class="hint">Sin usuarios de prueba. Elige gente cercana con la que puedan validar sin fricción y agrégala en su pestaña.</div>'}</div><a class="btn quiet sm more" href="${rutaDe('usuarios')}">Ver usuarios de prueba</a></section>`;
  const otros = Object.keys(P()).filter((p) => p !== me); const otrosEnLinea = otros.filter((p) => S.enLinea.includes(p)).length;
  h += `<section class="box"><h2>El equipo <span class="n">${otrosEnLinea === 0 ? 'nadie más en línea' : `${otrosEnLinea} en línea`}</span></h2><div>${otros.map((p) => {
    const suyas = tareas().filter((t) => t.responsable === p && t.estado !== 'hecha').sort(ordenTareas);
    const l = [...suyas.filter((t) => t.estado === 'en_curso'), ...suyas.filter((t) => t.estado === 'bloqueada'), ...suyas.filter((t) => t.estado === 'pendiente')].slice(0, 4);
    return `<div class="persona-row">${avatar(p, S.enLinea.includes(p) ? '' : 'off')}<div><div class="nom">${esc(nombre(p))}<span class="tag">${esc(P()[p].rol)}</span>${S.enLinea.includes(p) ? '<span class="pill ok">en línea</span>' : ''}</div>${l.length ? `<ul>${l.map((t) => `<li><button class="tit lnk" type="button" data-act="abrir" data-mod="tareas" data-id="${esc(t.id)}">${esc(t.titulo)}</button> ${pillEstado(t)}${pillVence(t)}</li>`).join('')}${suyas.length > 4 ? `<li class="tag">y ${suyas.length - 4} más</li>` : ''}</ul>` : '<div class="hint">sin tareas abiertas</div>'}</div></div>`;
  }).join('')}</div></section>`;
  const artFase = ARTEF.filter((a) => a[2] === it.fase); const cand = ideas().filter((i) => i.etapa === 'candidata').length; const eleg = ideas().filter((i) => i.etapa === 'elegida').length; const bloqueadas = tareas().filter((t) => t.estado === 'bloqueada');
  h += `<section class="box"><h2>Pendiente de la fase <span class="n">${esc(FASES[it.fase] || it.fase)}</span></h2><div class="lista">`
    + (artFase.length ? artFase.map((a) => { const x = (it.artefactos || {})[a[0]] || {}; return `<div class="item-t${x.hecho ? ' hecha' : ''}"><span class="check${x.hecho ? ' on' : ''}" aria-hidden="true">✓</span><div><a class="tit" href="${rutaDe('iteracion')}">${esc(a[1])}</a><div class="tags">${x.hecho ? '<span class="pill ok">hecho</span>' : '<span class="tag">entregable de la fase</span>'}${ligaAbrir(x.liga)}</div></div></div>`; }).join('') : '<div class="hint">Esta fase no tiene entregable propio.</div>')
    + `<div class="item-t"><span class="check${eleg ? ' on' : ''}" aria-hidden="true">✓</span><div><a class="tit" href="${rutaDe('oportunidades')}">Oportunidades: ${cand} candidata${cand === 1 ? '' : 's'}, ${eleg} elegida${eleg === 1 ? '' : 's'}</a><div class="tags"><span class="tag">${ideas().length} en total</span></div></div></div>`
    + (bloqueadas.length ? `<div class="item-t"><span class="check alert" aria-hidden="true">!</span><div><a class="tit" href="${rutaDe('tareas')}">${bloqueadas.length} tarea${bloqueadas.length === 1 ? '' : 's'} bloqueada${bloqueadas.length === 1 ? '' : 's'}</a><div class="tags">${bloqueadas.slice(0, 3).map((t) => `<span class="pill bad">${esc(t.titulo)}</span>`).join('')}</div></div></div>` : '')
    + '</div></section>';
  const acts = actividad().slice(0, 8);
  h += `<section class="box"><h2>Últimos movimientos</h2><div class="feed compact">${acts.length ? acts.map(itemActividad).join('') : '<div class="hint">Aún no pasa nada. Lo que hagan los tres queda aquí.</div>'}</div><a class="btn quiet sm more" href="${rutaDe('actividad')}">Ver toda la actividad</a></section>`;
  h += '</div>';
  return h;
}

export default {
  id: 'hoy', titulo: 'Hoy', icono: 'hoy', orden: 1, principal: true,
  vista,
  submits: {
    'add-mia': async (f) => {
      const inp = f.querySelector('#mia-new'); const t = inp.value.trim(); if (!t) return;
      const ok = await guardarTarea({ id: uid(), titulo: t, detalle: '', motivo: '', responsable: yo(), fase: iteracion().fase, estado: 'pendiente', vence: (f.querySelector('#mia-vence') || {}).value || '', ideaId: '' });
      if (ok) { const i2 = document.getElementById('mia-new'); if (i2) i2.value = ''; }
    },
  },
};
