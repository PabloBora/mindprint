/* Estado del cliente, constantes del método (Plan v0.3) y helpers de datos. Sin DOM al importar. */
export const PERSONAS_LOCAL = {
  pablo: { nombre: 'Pablo', rol: 'Tecnología' },
  max: { nombre: 'Max', rol: 'Procesos' },
  daniel: { nombre: 'Daniel', rol: 'Mercado y usuarios de prueba' },
};
export const RESP = { pablo: 'Pablo', max: 'Max', daniel: 'Daniel', todos: 'Los tres' };
export const STAGES = [['semilla', 'Detectada'], ['explorada', 'Explorada'], ['candidata', 'Candidata'], ['elegida', 'Elegida'], ['descartada', 'Descartada']];
export const PHASES = [['elegir', 'Detectar', 'sem 0–1'], ['entender', 'Explorar', 'sem 1–2'], ['construir', 'Construir', 'sem 2–4'], ['validar', 'Probar', 'sem 4–6'], ['decidir', 'Decidir', 'cierre']];
export const FASES = Object.fromEntries([['general', 'General'], ...PHASES.map((p) => [p[0], p[1]])]);
export const ESTADOS = [['pendiente', 'Pendiente'], ['en_curso', 'En curso'], ['bloqueada', 'Bloqueada'], ['hecha', 'Hecha']];
export const CRIT = [['comun', 'Frecuente y común'], ['dolor', 'Dolor evidente'], ['estandar', 'Entradas y salidas estándar'], ['construible', 'Lo podemos construir']];
export const REACC = [['late', 'Me late'], ['dudo', 'Dudo'], ['cliente', 'Tengo con quién probarla']];
export const ARTEF = [['oportunidad', 'Oportunidad elegida, con razón', 'elegir'], ['proceso_tipo', 'Mapa del proceso tipo (varias empresas)', 'entender'], ['solucion', 'Solución rápida en una frase, y qué queda fuera', 'entender'], ['prototipo', 'Prototipo con medición de uso', 'construir'], ['demo_doc', 'Demo interna y documentación breve', 'construir'], ['usuarios', 'Usuarios de prueba elegidos', 'validar'], ['senales', 'Señales de tracción registradas', 'validar'], ['costos', 'Costo por ejecución medido', 'validar'], ['decision', 'Decisión de cierre: productizar / ajustar / descartar', 'decidir']];
export const ETAPAS_P = [['candidato', 'Candidato'], ['contactado', 'Contactado'], ['probando', 'Probando'], ['jala', 'Jala'], ['descartado', 'Descartado']];
export const SENALES = [['prueba', 'La prueba sin que insistamos'], ['repite', 'La vuelve a usar por su cuenta'], ['pide', 'Pide algo más'], ['recomienda', 'La recomienda o preguntan por ella'], ['pagaria', 'Pagaría algo por uso']];
export const TIPOS_DEC = [['seguir', 'Productizar'], ['ajustar', 'Ajustar'], ['descartar', 'Descartar'], ['otra', 'Otra']];
export const VOTOS_MAX = 3;
export const PROVOCACIONES = [
  '¿Qué proceso repetitivo viste esta semana que alguien hace a mano y nadie cuestiona?',
  '¿Quién paga hoy, en horas o en dinero, por mover información de un sistema a otro?',
  '¿Qué empresa cercana nos dejaría probar algo sin ceremonia?',
  '¿Qué haría un agente que trabaja 24/7 en esa oficina, si solo pudiera leer y proponer?',
  '¿Dónde se pierde una venta o un cobro porque nadie dio seguimiento a tiempo?',
  '¿Qué decisión chica se toma cien veces al día con la misma regla?',
  '¿Qué reporte se arma cada semana copiando y pegando de tres lugares?',
  '¿Qué pregunta le hacen al dueño diez veces al día que podría responder un agente?',
  '¿Qué trámite o formato obligatorio se llena siempre con los mismos datos?',
  '¿Qué proceso ya intentaron automatizar y fracasó? ¿Por qué falló y qué cambió desde entonces?',
];

/* ---------- preferencias por navegador ---------- */
export function lsGet(k, d) { try { const v = globalThis.localStorage && globalThis.localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }
export function lsSet(k, v) { try { globalThis.localStorage && globalThis.localStorage.setItem(k, v); } catch { /* sin storage */ } }

/* ---------- filtros y preferencias que se recuerdan en este navegador ---------- */
const FILTROS_DEF = {
  tareas: { resp: 'todas', fase: 'todas', col: 'pendiente', verHechas: false, orden: 'vence', colapsadas: [] },
  oportunidades: { autor: 'todos', q: '', stage: 'semilla', orden: 'votos', colapsadas: [] },
  usuarios: { resp: 'todas', col: 'candidato', orden: 'siguiente', colapsadas: [] },
  actividad: { quien: 'todos', tipo: 'todo' },
};
/** Lee los filtros guardados sobre los valores por defecto; tolera basura y migra la preferencia vieja de tareas. */
export function leerFiltros(get = lsGet) {
  let guardado = {}; try { guardado = JSON.parse(get('mp.filtros', '{}')) || {}; } catch { guardado = {}; }
  const out = {};
  for (const [k, def] of Object.entries(FILTROS_DEF)) {
    const g = guardado[k] && typeof guardado[k] === 'object' && !Array.isArray(guardado[k]) ? guardado[k] : {};
    out[k] = { ...def, ...g };
    if ('colapsadas' in def) out[k].colapsadas = Array.isArray(out[k].colapsadas) ? out[k].colapsadas.filter((x) => typeof x === 'string') : [];
  }
  const viejo = get('mp.f.tareas.resp', null);
  if (viejo && !(guardado.tareas && guardado.tareas.resp)) out.tareas.resp = viejo;
  return out;
}
/** Guarda los filtros actuales (sin lo pasajero: «ver todas las hechas» y el texto de búsqueda). */
export function guardarFiltros(set = lsSet) {
  const { tareas, oportunidades, usuarios, actividad } = S.f;
  set('mp.filtros', JSON.stringify({ tareas: { ...tareas, verHechas: false }, oportunidades: { ...oportunidades, q: '' }, usuarios, actividad }));
}
export const ORDENES = {
  tareas: [['vence', 'Por fecha'], ['recientes', 'Recientes'], ['titulo', 'Por título']],
  oportunidades: [['votos', 'Por votos'], ['criterios', 'Por criterios'], ['recientes', 'Recientes']],
  usuarios: [['siguiente', 'Por siguiente paso'], ['recientes', 'Recientes'], ['nombre', 'Por nombre']],
};
const porReciente = (a, b) => String(b.actualizado || b.creado || '').localeCompare(String(a.actualizado || a.creado || ''));
const porTexto = (campo) => (a, b) => String(a[campo] || '').localeCompare(String(b[campo] || ''), 'es', { sensitivity: 'base' });
/** Ordena una copia de la lista según el tablero y el orden elegido. */
export function ordenar(tablero, lista, orden) {
  const l = lista.slice();
  if (orden === 'recientes') return l.sort(porReciente);
  if (tablero === 'tareas') return l.sort(orden === 'titulo' ? porTexto('titulo') : ordenTareas);
  if (tablero === 'usuarios') return l.sort(orden === 'nombre' ? porTexto('empresa') : ordenProspectos);
  if (tablero === 'oportunidades') return l.sort(orden === 'criterios' ? (a, b) => (scoreIdea(b) - scoreIdea(a)) || (votosIdea(b) - votosIdea(a)) : sortIdeas);
  return l;
}

/* ---------- estado vivo ---------- */
export const S = {
  estado: null, yo: null, enLinea: [], sinSesion: false, conexion: 'conectando', errEntrada: '',
  ruta: { mod: 'hoy', id: null, sub: null },
  tema: lsGet('mp.tema', 'auto'),
  leido: lsGet('mp.chat.leido', ''),
  prov: Math.floor(Math.random() * PROVOCACIONES.length),
  tipoDec: 'otra',
  f: leerFiltros(),
  letra: lsGet('mp.letra', 'normal'),
  sonido: lsGet('mp.sonido', 'no') === 'si',
  arrastrando: null, arrastrandoKind: 'idea',
  guardando: 0, ultimoGuardado: '', fotoOffline: false, version: '', versionNueva: null,
  menuAbierto: null, mover: null, ayuda: false, busqAbierta: false, busqIdx: -1, resaltado: '',
};

export const P = () => (S.estado && S.estado.personas) || PERSONAS_LOCAL;
export const yo = () => (S.yo ? S.yo.persona : '');
export const nombre = (p) => (P()[p] ? P()[p].nombre : RESP[p] || '');

/* ---------- helpers de datos ---------- */
export const ideas = () => (S.estado && S.estado.ideas) || [];
export const tareas = () => (S.estado && S.estado.tareas) || [];
export const prospectos = () => (S.estado && S.estado.prospectos) || [];
export const mensajes = () => (S.estado && S.estado.mensajes) || [];
export const actividad = () => (S.estado && S.estado.actividad) || [];
export const iteracion = () => (S.estado && S.estado.iteracion) || { numero: 1, fase: 'elegir', semanas: 6, artefactos: {}, decisiones: [], dedicacion: {} };

export const ideaById = (id) => ideas().find((i) => i.id === id);
export const tareaById = (id) => tareas().find((t) => t.id === id);
export const prospectoById = (id) => prospectos().find((p) => p.id === id);

export const votosUsados = (p) => ideas().reduce((a, i) => a + ((i.votos || {})[p] || 0), 0);
export const votosIdea = (i) => Object.values(i.votos || {}).reduce((a, b) => a + (b || 0), 0);
export const scoreIdea = (i) => CRIT.reduce((a, [k]) => a + ((i.criterios || {})[k] || 0), 0);
export function reaccCount(i) { const out = {}; Object.values(i.reacciones || {}).forEach((v) => { if (v) out[v] = (out[v] || 0) + 1; }); return out; }
export const sortIdeas = (a, b) => (votosIdea(b) - votosIdea(a)) || (scoreIdea(b) - scoreIdea(a)) || String(a.creado || '').localeCompare(String(b.creado || ''));

export const esMia = (t) => t.responsable === yo() || t.responsable === 'todos';
export const ordenTareas = (a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9')) || String(a.creado || '').localeCompare(String(b.creado || ''));

export const enJuego = (p) => p.etapa !== 'descartado';
export const nSenales = (p) => Object.values(p.senales || {}).filter(Boolean).length;
export const ordenProspectos = (a, b) => String(a.fechaSiguiente || '9').localeCompare(String(b.fechaSiguiente || '9')) || String(a.creado || '').localeCompare(String(b.creado || ''));
export const etiquetaEtapaP = (k) => (ETAPAS_P.find((e) => e[0] === k) || [])[1] || k;

export const comentariosDe = (tipo, id) => mensajes().filter((m) => m.ref && m.ref.tipo === tipo && m.ref.id === id);
export const noLeidos = () => mensajes().filter((m) => m.quien !== yo() && String(m.fecha) > String(S.leido || '')).length;
/** Mensajes sin leer de otros que me mencionan (@pablo, @max, @daniel). */
export const mencionesSinLeer = () => { const me = yo(); if (!me) return 0; const re = new RegExp(`(^|[^\\w])@${me}\\b`, 'i'); return mensajes().filter((m) => m.quien !== me && String(m.fecha) > String(S.leido || '') && re.test(m.texto || '')).length; };
export const semanasDe = (it) => (it && it.semanas) || 6;

/** Referencia a un elemento por tipo: título y módulo/ruta para abrirlo. */
export function refInfo(tipo, id) {
  if (tipo === 'idea') { const i = ideaById(id); return i ? { titulo: i.titulo, mod: 'oportunidades', etiqueta: 'oportunidad' } : null; }
  if (tipo === 'tarea') { const t = tareaById(id); return t ? { titulo: t.titulo, mod: 'tareas', etiqueta: 'tarea' } : null; }
  if (tipo === 'prospecto') { const p = prospectoById(id); return p ? { titulo: p.empresa, mod: 'usuarios', etiqueta: 'usuario de prueba' } : null; }
  return null;
}
