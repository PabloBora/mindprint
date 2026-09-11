// Validación de documentos: el servidor solo guarda lo que pasa por aquí.
import { PERSONAS } from './auth.js';

export const ETAPAS = ['semilla', 'explorada', 'candidata', 'elegida', 'descartada'];
export const FASES = ['general', 'elegir', 'entender', 'construir', 'validar', 'decidir'];
export const FASES_ITERACION = ['elegir', 'entender', 'construir', 'validar', 'decidir'];
export const ESTADOS = ['pendiente', 'en_curso', 'bloqueada', 'hecha'];
export const RESPONSABLES = [...Object.keys(PERSONAS), 'todos'];
export const REACCIONES = ['', 'late', 'dudo', 'cliente'];
export const CRITERIOS = ['acceso', 'dolor', 'agentizable'];
export const ARTEFACTOS = ['candidatos', 'mapa', 'mvpdef', 'mvp', 'demo', 'decision'];
export const TIPOS_DECISION = ['seguir', 'ajustar', 'descartar', 'otra'];
export const VOTOS_MAX = 3;

export class ErrorValidacion extends Error {
  constructor(codigo, detalle) { super(detalle || codigo); this.code = codigo; this.status = 400; }
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
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) falla('id_invalido', 'id: letras, dígitos, _ o -, máximo 64');
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
    numero: 1, fase: 'elegir', inicio: '', demo: '', sincronia: '', canal: '',
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
    inicio: fechaDia(src.inicio),
    demo: fechaDia(src.demo),
    sincronia: texto(src.sincronia, 120),
    canal: texto(src.canal, 120),
    dedicacion: Object.fromEntries(Object.keys(PERSONAS).map((p) => [p, texto(objeto(src.dedicacion)[p], 60)])),
    artefactos: Object.fromEntries(ARTEFACTOS.map((a) => { const x = objeto(art[a]); return [a, { hecho: x.hecho === true, liga: texto(x.liga, 500) }]; })),
    decisiones,
  };
}
