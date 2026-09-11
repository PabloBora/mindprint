// Validación de documentos: el servidor solo guarda lo que pasa por aquí.
import { PERSONAS } from './auth.js';

export const ETAPAS = ['semilla', 'explorada', 'candidata', 'elegida', 'descartada'];
export const FASES = ['general', 'elegir', 'entender', 'construir', 'validar', 'decidir'];
export const FASES_ITERACION = ['elegir', 'entender', 'construir', 'validar', 'decidir'];
export const ESTADOS = ['pendiente', 'en_curso', 'bloqueada', 'hecha'];
export const RESPONSABLES = [...Object.keys(PERSONAS), 'todos'];
export const REACCIONES = ['', 'late', 'dudo', 'cliente'];
export const CRITERIOS = ['acceso', 'dolor', 'agentizable'];
// Entregables del Plan Maestro v0.2 (§10, §14), uno por fase de la iteración.
export const ARTEFACTOS = ['caso', 'prospecto', 'mapa', 'caso_negocio', 'demo', 'doc_interna', 'propuesta', 'costos', 'decision'];
export const ETAPAS_PROSPECTO = ['seleccion', 'descubrimiento', 'caso_negocio', 'propuesta', 'piloto', 'conversion', 'descartado'];
export const SEMANAS_DEFAULT = 6;
export const TIPOS_DECISION = ['seguir', 'ajustar', 'descartar', 'otra'];
export const VOTOS_MAX = 3;
export const MENSAJES_MAX = 500;
export const REF_TIPOS = ['idea', 'tarea', 'prospecto'];

export class ErrorValidacion extends Error {
  constructor(codigo, detalle) { super(detalle || codigo); this.code = codigo; this.status = 400; }
}
/** Acción sobre algo ajeno (p. ej. borrar el mensaje de otra persona): 403. */
export class ErrorProhibido extends Error {
  constructor(codigo, detalle) { super(detalle || codigo); this.code = codigo; this.status = 403; }
}
/** Regla de negocio que choca con el estado actual (p. ej. votos agotados): 409. */
export class ErrorConflicto extends Error {
  constructor(codigo, detalle) { super(detalle || codigo); this.code = codigo; this.status = 409; }
}
const falla = (c, d) => { throw new ErrorValidacion(c, d); };

const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const enumo = (v, lista, def) => (lista.includes(v) ? v : def);
const entero = (v, min, max) => { const n = Number.isInteger(v) ? v : parseInt(v, 10); if (!Number.isFinite(n)) return min; return Math.min(max, Math.max(min, n)); };
const fechaISO = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '');
const fechaDia = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : '';
};
const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function idValido(id) {
  // Firestore reserva los ids con forma __x__; se rechazan aquí para que sea 400 y no 500.
  if (typeof id !== 'string' || !/^(?!__.*__$)[A-Za-z0-9_-]{1,64}$/.test(id)) falla('id_invalido', 'id: letras, dígitos, _ o -, máximo 64, no __reservado__');
  return id;
}

function porPersona(v, transformar) {
  const src = objeto(v); const out = {};
  for (const p of Object.keys(PERSONAS)) if (p in src) out[p] = transformar(src[p]);
  return out;
}

export function validarIdea(b) {
  const src = objeto(b);
  const titulo = texto(src.titulo, 140).trim();
  if (!titulo) falla('titulo_requerido', 'La idea necesita un título');
  return {
    id: idValido(src.id),
    titulo,
    dolor: texto(src.dolor, 600),
    quien: texto(src.quien, 400),
    agente: texto(src.agente, 600),
    validacion: texto(src.validacion, 600),
    notas: texto(src.notas, 2000),
    autor: enumo(src.autor, Object.keys(PERSONAS), ''),
    etapa: enumo(src.etapa, ETAPAS, 'semilla'),
    votos: porPersona(src.votos, (n) => entero(n, 0, VOTOS_MAX)),
    criterios: Object.fromEntries(CRITERIOS.map((k) => [k, entero(objeto(src.criterios)[k], 0, 2)])),
    reacciones: porPersona(src.reacciones, (r) => enumo(r, REACCIONES, '')),
    creado: fechaISO(src.creado),
  };
}

export function validarTarea(b) {
  const src = objeto(b);
  const titulo = texto(src.titulo, 160).trim();
  if (!titulo) falla('titulo_requerido', 'La tarea necesita un título');
  return {
    id: idValido(src.id),
    titulo,
    detalle: texto(src.detalle, 600),
    motivo: texto(src.motivo, 300),
    responsable: enumo(src.responsable, RESPONSABLES, 'todos'),
    fase: enumo(src.fase, FASES, 'general'),
    estado: enumo(src.estado, ESTADOS, 'pendiente'),
    vence: fechaDia(src.vence),
    ideaId: typeof src.ideaId === 'string' && /^[A-Za-z0-9_-]{0,64}$/.test(src.ideaId) ? src.ideaId : '',
    creado: fechaISO(src.creado),
  };
}

export function iteracionInicial() {
  return {
    numero: 1, fase: 'elegir', semanas: SEMANAS_DEFAULT, inicio: '', demo: '', sincronia: '', canal: '',
    dedicacion: { pablo: '', max: '', daniel: '' },
    artefactos: Object.fromEntries(ARTEFACTOS.map((a) => [a, { hecho: false, liga: '' }])),
    decisiones: [],
  };
}

export function validarIteracion(b) {
  const src = objeto(b);
  const art = objeto(src.artefactos);
  const decisiones = (Array.isArray(src.decisiones) ? src.decisiones : []).slice(-200).map((d) => {
    const x = objeto(d);
    return { fecha: fechaISO(x.fecha) || new Date().toISOString(), quien: enumo(x.quien, Object.keys(PERSONAS), ''), tipo: enumo(x.tipo, TIPOS_DECISION, 'otra'), texto: texto(x.texto, 1000).trim() };
  }).filter((d) => d.texto);
  return {
    numero: entero(src.numero, 1, 999),
    fase: enumo(src.fase, FASES_ITERACION, 'elegir'),
    semanas: src.semanas == null || src.semanas === '' ? SEMANAS_DEFAULT : entero(src.semanas, 4, 8),
    inicio: fechaDia(src.inicio),
    demo: fechaDia(src.demo),
    sincronia: texto(src.sincronia, 120),
    canal: texto(src.canal, 120),
    dedicacion: Object.fromEntries(Object.keys(PERSONAS).map((p) => [p, texto(objeto(src.dedicacion)[p], 60)])),
    artefactos: Object.fromEntries(ARTEFACTOS.map((a) => { const x = objeto(art[a]); return [a, { hecho: x.hecho === true, liga: texto(x.liga, 500) }]; })),
    decisiones,
  };
}

/** Mensaje de chat (sin ref) o comentario (ref a idea/tarea). El servidor sella id/fecha/quien. */
export function validarMensaje(b) {
  const src = objeto(b);
  const cuerpo = texto(src.texto, 1000).trim();
  if (!cuerpo) falla('texto_requerido', 'El mensaje está vacío');
  let ref = null;
  if (src.ref != null && src.ref !== '') {
    const r = objeto(src.ref);
    if (!REF_TIPOS.includes(r.tipo)) falla('ref_invalida', `ref.tipo debe ser ${REF_TIPOS.join(', ')}`);
    ref = { tipo: r.tipo, id: idValido(r.id), titulo: texto(r.titulo, 160) };
  }
  return { texto: cuerpo, ref };
}

/** Prospecto del embudo comercial (Plan Maestro §9.2). */
export function validarProspecto(b) {
  const src = objeto(b);
  const empresa = texto(src.empresa, 160).trim();
  if (!empresa) falla('empresa_requerida', 'El prospecto necesita el nombre de la empresa');
  return {
    id: idValido(src.id),
    empresa,
    contacto: texto(src.contacto, 160),
    area: texto(src.area, 120),
    casoId: typeof src.casoId === 'string' && /^[A-Za-z0-9_-]{0,64}$/.test(src.casoId) ? src.casoId : '',
    razon: texto(src.razon, 600),
    dolor: texto(src.dolor, 600),
    baseline: texto(src.baseline, 600),
    siguientePaso: texto(src.siguientePaso, 300),
    fechaSiguiente: fechaDia(src.fechaSiguiente),
    responsable: enumo(src.responsable, RESPONSABLES, 'todos'),
    notas: texto(src.notas, 2000),
    etapa: enumo(src.etapa, ETAPAS_PROSPECTO, 'seleccion'),
    creado: fechaISO(src.creado),
  };
}
