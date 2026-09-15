/* Iteración: fase, datos, entregables del Plan v0.3, decisiones y provocación. */
import { S, P, yo, nombre, iteracion, PHASES, FASES, ARTEF, TIPOS_DEC, PROVOCACIONES, semanasDe } from '../estado.js';
import { esc, fmtDia, fmtFechaHora, diasHasta, semanaDe, setPath } from '../ui/base.js';
import { ligaAbrir } from '../ui/piezas.js';
import { guardarIteracion } from '../api.js';

function vista() {
  const it = iteracion(); const B = (c) => `data-bind="iter:actual:${c}"`;
  const idx = PHASES.findIndex((p) => p[0] === it.fase); const sem = semanaDe(it.inicio); const SEM = semanasDe(it);
  const pct = sem == null ? 0 : Math.min(100, Math.round((sem / SEM) * 100)); const dDemo = diasHasta(it.demo);
  let h = '<div class="grid2">';
  h += `<div class="box"><h2>Iteración ${esc(it.numero || 1)}<small>${FASES[it.fase] || it.fase}${sem != null ? ` · semana ${sem} de ${SEM}` : ' · sin fecha de inicio'}${dDemo != null ? (dDemo < 0 ? ` · la prueba fue hace ${-dDemo} d` : dDemo === 0 ? ' · la prueba es hoy' : ` · ${dDemo} d para la prueba`) : ''}</small></h2>`
    + `<div><div class="bar"><i style="width:${pct}%"></i></div><div class="barlbl"><span>${it.inicio ? `inicio ${fmtDia(it.inicio)}` : 'pon la fecha de inicio'}</span><span>${it.demo ? `prueba ${fmtDia(it.demo)}` : `${SEM} semanas`}</span></div></div>`
    + `<div class="stepper">${PHASES.map((p, i) => `<button type="button" class="step${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}" data-act="fase" data-f="${p[0]}"><span>${p[1]}</span><small>${p[2]}</small></button>`).join('')}</div>`
    + '<div class="datos">'
    + `<div class="field"><label>Inicio</label><input class="in" type="date" ${B('inicio')} value="${esc(it.inicio)}"></div>`
    + `<div class="field"><label>Prueba con usuarios (fecha objetivo)</label><input class="in" type="date" ${B('demo')} value="${esc(it.demo)}"></div>`
    + `<div class="field"><label>Sincronía semanal</label><input class="in" ${B('sincronia')} value="${esc(it.sincronia)}" placeholder="día y hora, 30 min"></div>`
    + `<div class="field"><label>Canal del día a día</label><input class="in" ${B('canal')} value="${esc(it.canal)}" placeholder="WhatsApp, Slack…"></div>`
    + Object.keys(P()).map((k) => `<div class="field"><label>Dedicación · ${esc(P()[k].nombre)}</label><input class="in" ${B(`dedicacion.${k}`)} value="${esc((it.dedicacion || {})[k])}" placeholder="h por semana"></div>`).join('')
    + `<div class="field"><label>Número de iteración</label><input class="in" type="number" min="1" ${B('numero')} value="${esc(it.numero || 1)}"></div>`
    + `<div class="field"><label>Semanas de la iteración (4–8)</label><input class="in" type="number" min="4" max="8" ${B('semanas')} value="${esc(SEM)}"></div>`
    + '</div></div>';
  h += '<div style="display:grid;gap:16px">';
  h += `<div class="box"><h2>Entregables<small>uno por fase</small></h2><div>${ARTEF.map((a) => { const x = (it.artefactos || {})[a[0]] || {}; return `<div class="art${x.hecho ? ' ok' : ''}"><input type="checkbox" ${B(`artefactos.${a[0]}.hecho`)}${x.hecho ? ' checked' : ''} aria-label="${a[1]}"><span class="name">${a[1]}<span class="tag">${FASES[a[2]]}</span>${ligaAbrir(x.liga)}</span><input class="in" ${B(`artefactos.${a[0]}.liga`)} value="${esc(x.liga)}" placeholder="liga"></div>`; }).join('')}</div></div>`;
  h += `<div class="box"><h2>Decisiones<small>productizar · ajustar · descartar</small></h2><form data-submit="add-dec" style="display:grid;gap:8px"><div class="seg">${TIPOS_DEC.map(([k, n]) => `<button type="button" data-act="tipodec" data-v="${k}" aria-pressed="${S.tipoDec === k}">${n}</button>`).join('')}</div><textarea class="in" id="dec-new" data-keep="dec-new" rows="2" placeholder="Qué decidimos y por qué, en una o dos líneas" required></textarea><div><button class="btn primary sm" type="submit">Registrar decisión</button></div></form>`;
  const decs = (it.decisiones || []).slice().reverse();
  h += `<div class="dec">${decs.length ? decs.map((d) => `<div class="item ${esc(d.tipo || 'otra')}"><span class="k">${fmtFechaHora(d.fecha)}${d.quien ? ` · ${esc(nombre(d.quien))}` : ''} · ${esc((TIPOS_DEC.find((t) => t[0] === d.tipo) || [])[1] || 'otra')}</span>${esc(d.texto)}</div>`).join('') : '<span class="tag">todavía ninguna</span>'}</div></div>`;
  h += `<div class="box"><h2>Provocación</h2><p class="prov">${esc(PROVOCACIONES[S.prov % PROVOCACIONES.length])}</p><div><button class="btn sm" type="button" data-act="prov">Otra</button></div></div>`;
  h += '</div></div>';
  return h;
}
export default {
  id: 'iteracion', titulo: 'Iteración', icono: 'iteracion', orden: 6, principal: false,
  badge: () => `#${iteracion().numero || 1}`,
  vista,
  acciones: {
    'fase': async (el) => { const it = iteracion(); if (it.fase !== el.dataset.f) await guardarIteracion({ ...it, fase: el.dataset.f }); },
    'tipodec': (el) => { S.tipoDec = el.dataset.v; S.render(); },
    'prov': () => { S.prov = (S.prov + 1) % PROVOCACIONES.length; S.render(); },
  },
  binds: { iter: async (id, campo, val) => { const it = JSON.parse(JSON.stringify(iteracion())); setPath(it, campo, val); await guardarIteracion(it); } },
  submits: {
    'add-dec': async (form) => {
      const ta = form.querySelector('#dec-new'); const txt = ta.value.trim(); if (!txt) return;
      const it = iteracion(); const ok = await guardarIteracion({ ...it, decisiones: [...(it.decisiones || []), { fecha: new Date().toISOString(), quien: yo(), tipo: S.tipoDec, texto: txt }] });
      if (ok) { const t2 = document.getElementById('dec-new'); if (t2) t2.value = ''; }
    },
  },
};
