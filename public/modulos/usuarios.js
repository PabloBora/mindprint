/* Usuarios de prueba: gente cercana con la que se valida; etapas y señales del Plan v0.3. */
import { S, prospectos, ideas, prospectoById, enJuego, ordenProspectos, RESP, ETAPAS_P, SENALES, P } from '../estado.js';
import { esc, icono, avatar, uid, toast, confirmar, setPath } from '../ui/base.js';
import { cardProspecto, seccionComentarios, pieEdicion } from '../ui/piezas.js';
import { guardarProspecto, borrarProspecto } from '../api.js';
import { rutaDe, reemplazar } from '../ruta.js';

const f = () => S.f.usuarios;
const coincide = (p) => { const q = (S.q || '').trim().toLowerCase(); return !q || `${p.empresa} ${p.contacto} ${p.relacion} ${p.area} ${p.siguientePaso}`.toLowerCase().includes(q); };
const opcionesCaso = (sel) => `<option value="">por definir</option>${ideas().slice().sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))).map((i) => `<option value="${esc(i.id)}"${sel === i.id ? ' selected' : ''}>${esc(i.titulo)}</option>`).join('')}`;

function vista() {
  let list = prospectos().filter(coincide);
  if (f().resp !== 'todas') list = list.filter((p) => p.responsable === f().resp || p.responsable === 'todos');
  let h = `<div class="toolbar"><div class="chips"><button class="chip" data-act="fresp-p" data-v="todas" aria-pressed="${f().resp === 'todas'}">Todos</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="fresp-p" data-v="${p}" aria-pressed="${f().resp === p}">${avatar(p)}${esc(P()[p].nombre)}</button>`).join('')}</div><span class="hint">Gente y empresas cercanas con las que validamos sin fricción. Miramos si la prueban sin insistir, la repiten, piden más, la recomiendan o pagarían.</span><a class="btn primary sm" href="${rutaDe('usuarios', 'nuevo')}">${icono('mas', 'sm')}Nuevo usuario de prueba</a></div>`;
  if (!prospectos().length) h += '<div class="vacio"><b>Todavía no hay usuarios de prueba.</b> Agrega a alguien cercano; después abre la tarjeta para anotar cómo lo conocemos, qué prueba, las señales y el siguiente paso con fecha.</div>';
  h += `<div class="stagebar chips">${ETAPAS_P.map((e) => `<button class="chip" data-act="colp" data-v="${e[0]}" aria-pressed="${f().col === e[0]}">${e[1]} <span class="tag">${list.filter((p) => p.etapa === e[0]).length}</span></button>`).join('')}</div>`;
  h += '<div class="board">';
  for (const [k, label] of ETAPAS_P) {
    const items = list.filter((p) => p.etapa === k).sort(ordenProspectos);
    h += `<section class="col${f().col === k ? ' active' : ''}${items.length ? '' : ' empty'}" data-col="${k}" data-kind="prospecto"><h3><span class="${k === 'jala' ? 'hl' : ''}">${label}</span><span class="n">${items.length}</span></h3><div class="cards">${items.map(cardProspecto).join('')}</div></section>`;
  }
  h += '</div>';
  return h;
}

function panel(id) {
  if (id === 'nuevo') {
    return { titulo: 'Nuevo usuario de prueba', html: `<form data-submit="add-prospecto" class="panel-mod">
      <div class="field"><label>Quién</label><input class="in" name="empresa" data-keep="prospecto-new" placeholder="Persona o empresa cercana para probar" maxlength="160" autocomplete="off" required></div>
      <div class="datos"><div class="field"><label>Contacto</label><input class="in" name="contacto" placeholder="Nombre y puesto"></div><div class="field"><label>Cómo lo conocemos</label><input class="in" name="relacion" placeholder="Cliente de Vitali, amigo, ex colega…"></div>
      <div class="field"><label>Responsable</label><select class="in" name="responsable">${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${k === 'daniel' ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Oportunidad</label><select class="in" name="casoId">${opcionesCaso('')}</select></div>
      <div class="field"><label>Siguiente paso</label><input class="in" name="siguientePaso" placeholder="Llamar, mandar liga de prueba…"></div><div class="field"><label>Para cuándo</label><input class="in" type="date" name="fechaSiguiente"></div></div>
      <div><button class="btn primary" type="submit">Agregar</button></div></form>` };
  }
  const p = prospectoById(id); if (!p) return null;
  const B = (c) => `data-bind="prospectos:${esc(p.id)}:${c}"`;
  const html = `<div class="fila-etapas"><div class="seg multi">${ETAPAS_P.map((e) => `<button type="button" data-act="etapa-p" data-id="${esc(p.id)}" data-s="${e[0]}" aria-pressed="${p.etapa === e[0]}">${e[1]}</button>`).join('')}</div></div>
    <input class="titulo" ${B('empresa')} value="${esc(p.empresa)}" maxlength="160" aria-label="Quién">
    <div class="datos"><div class="field"><label>Contacto</label><input class="in" ${B('contacto')} value="${esc(p.contacto)}" placeholder="Nombre y puesto"></div><div class="field"><label>Cómo lo conocemos</label><input class="in" ${B('relacion')} value="${esc(p.relacion || '')}" placeholder="Cliente de Vitali, amigo, ex colega…"></div><div class="field"><label>Área o proceso</label><input class="in" ${B('area')} value="${esc(p.area)}" placeholder="Ventas, compras, facturación…"></div></div>
    <div class="field"><label>Por qué es buen usuario de prueba</label><textarea class="in" rows="2" ${B('razon')} placeholder="Vive el proceso, nos deja probar sin fricción, opina con franqueza">${esc(p.razon)}</textarea></div>
    <div class="field"><label>Dolor que vimos</label><textarea class="in" rows="2" ${B('dolor')} placeholder="Tiempo manual, retrabajo, demora, errores">${esc(p.dolor)}</textarea></div>
    <div class="field"><label>Qué probó y qué medimos</label><textarea class="in" rows="2" ${B('baseline')} placeholder="Qué versión usó, cuántas veces, cuánto tardaba antes">${esc(p.baseline)}</textarea></div>
    <div class="lado"><div class="datos">
      <div class="field"><label>Siguiente paso</label><input class="in" ${B('siguientePaso')} value="${esc(p.siguientePaso)}" placeholder="Llamar, mandar liga, agendar"></div>
      <div class="field"><label>Para cuándo</label><input class="in" type="date" ${B('fechaSiguiente')} value="${esc(p.fechaSiguiente)}"></div>
      <div class="field"><label>Responsable</label><select class="in" ${B('responsable')}>${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${p.responsable === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Oportunidad</label><select class="in" ${B('casoId')}>${opcionesCaso(p.casoId)}</select></div></div>
      <div class="field"><label>Señales de que se vende sola</label><div class="senales">${SENALES.map(([k, n]) => `<label><input type="checkbox" ${B(`senales.${k}`)}${(p.senales || {})[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div></div>
    </div>
    <div class="field"><label>Notas</label><textarea class="in" rows="2" ${B('notas')} placeholder="Objeciones, preguntas, lo que dijeron">${esc(p.notas)}</textarea></div>
    ${seccionComentarios('prospecto', p.id)}`;
  return { titulo: `Usuario de prueba<span class="sr-only">: ${esc(p.empresa)}</span>`, html, pie: pieEdicion(p, 'del-prospecto', p.id) };
}

export default {
  id: 'usuarios', titulo: 'Usuarios de prueba', corto: 'Usuarios', icono: 'usuarios', orden: 3, principal: true, nuevo: true,
  badge: () => { const n = prospectos().filter(enJuego).length; return n ? String(n) : ''; },
  vista, panel,
  acciones: {
    'fresp-p': (el) => { f().resp = el.dataset.v; S.render(); },
    'colp': (el) => { f().col = el.dataset.v; S.render(); },
    'etapa-p': async (el) => { const p = prospectoById(el.dataset.id); if (p && p.etapa !== el.dataset.s) await guardarProspecto({ ...p, etapa: el.dataset.s }); },
    'del-prospecto': async (el) => { const p = prospectoById(el.dataset.id); if (!p) return; if (!(await confirmar({ titulo: 'Eliminar usuario de prueba', texto: `«${p.empresa}» se borra para los tres.`, ok: 'Eliminar', peligro: true }))) return; const copia = { ...p }; reemplazar(rutaDe('usuarios')); if (await borrarProspecto(p.id)) toast('Usuario de prueba eliminado', { accion: 'Deshacer', onAccion: () => guardarProspecto(copia), ms: 6000 }); },
  },
  binds: { prospectos: async (id, campo, val) => { const p = prospectoById(id); if (!p) return; const clon = JSON.parse(JSON.stringify(p)); if (campo.includes('.')) setPath(clon, campo, val); else { if (p[campo] === val) return; clon[campo] = val; } await guardarProspecto(clon); } },
  submits: {
    'add-prospecto': async (form) => {
      const d = Object.fromEntries(new FormData(form).entries()); const empresa = (d.empresa || '').trim(); if (!empresa) return;
      const ok = await guardarProspecto({ id: uid(), empresa, contacto: d.contacto || '', area: '', relacion: d.relacion || '', casoId: d.casoId || '', razon: '', dolor: '', baseline: '', siguientePaso: d.siguientePaso || '', fechaSiguiente: d.fechaSiguiente || '', responsable: d.responsable || 'daniel', notas: '', senales: {}, etapa: 'candidato' });
      if (ok) { f().col = 'candidato'; reemplazar(rutaDe('usuarios')); toast('Usuario de prueba agregado como candidato'); }
    },
  },
};
