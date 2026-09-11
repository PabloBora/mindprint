// Estado del tablero: caché en memoria + versión + avisos en vivo (SSE) + presencia + actividad.
// Todas las escrituras pasan por aquí (un solo contenedor: max-instances 1).
import { PERSONAS } from './auth.js';
import { validarIdea, validarTarea, validarIteracion, iteracionInicial, VOTOS_MAX, ErrorValidacion } from './validar.js';

const ACTIVIDAD_MAX = 100;
const ahora = () => new Date().toISOString();

export function crearEstado(datos) {
  const st = { version: 0, ideas: new Map(), tareas: new Map(), iteracion: iteracionInicial(), actividad: [], cargado: false };
  const clientes = new Set(); // { res, persona }

  async function cargar() {
    const t = await datos.cargarTodo();
    st.ideas = new Map(t.ideas.filter((d) => d && d.id).map((d) => [d.id, d]));
    st.tareas = new Map(t.tareas.filter((d) => d && d.id).map((d) => [d.id, d]));
    st.iteracion = t.iteracion ? { ...iteracionInicial(), ...validarIteracion(t.iteracion) } : iteracionInicial();
    st.actividad = Array.isArray(t.actividad) ? t.actividad.slice(0, ACTIVIDAD_MAX) : [];
    st.cargado = true;
  }

  const enLinea = () => [...new Set([...clientes].map((c) => c.persona))].filter(Boolean).sort();

  function snapshot(persona) {
    return {
      version: st.version,
      yo: persona ? { persona, ...PERSONAS[persona] } : null,
      personas: PERSONAS,
      ideas: [...st.ideas.values()],
      tareas: [...st.tareas.values()],
      iteracion: st.iteracion,
      actividad: st.actividad,
      enLinea: enLinea(),
    };
  }

  function emitir(evento, data) {
    const cuerpo = `event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clientes) { try { c.res.write(cuerpo); } catch { clientes.delete(c); } }
  }
  function bump() { st.version += 1; emitir('cambio', { version: st.version }); }

  async function registrar(ev) {
    st.actividad.unshift({ fecha: ahora(), ...ev });
    if (st.actividad.length > ACTIVIDAD_MAX) st.actividad.length = ACTIVIDAD_MAX;
    try { await datos.guardarActividad(st.actividad); } catch (e) { console.error('actividad no guardada', e.message); }
  }

  function comprobarVotos(idea) {
    for (const p of Object.keys(PERSONAS)) {
      const propios = idea.votos[p] || 0;
      if (!propios) continue;
      let otros = 0;
      for (const [id, i] of st.ideas) if (id !== idea.id) otros += (i.votos && i.votos[p]) || 0;
      if (otros + propios > VOTOS_MAX) throw new ErrorValidacion('sin_votos', `${PERSONAS[p].nombre} ya no tiene votos (máximo ${VOTOS_MAX})`);
    }
  }

  async function guardarIdea(cuerpo, persona) {
    const limpia = validarIdea(cuerpo);
    const previa = st.ideas.get(limpia.id);
    comprobarVotos(limpia);
    const doc = { ...limpia, creado: previa?.creado || limpia.creado || ahora(), actualizado: ahora(), actualizadoPor: persona };
    await datos.guardar('ideas', doc.id, doc);
    st.ideas.set(doc.id, doc);
    const accion = !previa ? 'crea' : previa.etapa !== doc.etapa ? 'mueve' : 'edita';
    await registrar({ quien: persona, accion, objeto: 'idea', id: doc.id, titulo: doc.titulo, ...(accion === 'mueve' ? { detalle: doc.etapa } : {}) });
    bump();
    return doc;
  }
  async function borrarIdea(id, persona) {
    const previa = st.ideas.get(id);
    if (!previa) return false;
    await datos.borrar('ideas', id);
    st.ideas.delete(id);
    await registrar({ quien: persona, accion: 'borra', objeto: 'idea', id, titulo: previa.titulo });
    bump();
    return true;
  }
  async function guardarTarea(cuerpo, persona) {
    const limpia = validarTarea(cuerpo);
    const previa = st.tareas.get(limpia.id);
    const doc = { ...limpia, creado: previa?.creado || limpia.creado || ahora(), actualizado: ahora(), actualizadoPor: persona };
    await datos.guardar('tareas', doc.id, doc);
    st.tareas.set(doc.id, doc);
    const accion = !previa ? 'crea' : previa.estado !== doc.estado ? 'mueve' : 'edita';
    await registrar({ quien: persona, accion, objeto: 'tarea', id: doc.id, titulo: doc.titulo, ...(accion === 'mueve' ? { detalle: doc.estado } : {}) });
    bump();
    return doc;
  }
  async function borrarTarea(id, persona) {
    const previa = st.tareas.get(id);
    if (!previa) return false;
    await datos.borrar('tareas', id);
    st.tareas.delete(id);
    await registrar({ quien: persona, accion: 'borra', objeto: 'tarea', id, titulo: previa.titulo });
    bump();
    return true;
  }
  async function guardarIteracion(cuerpo, persona) {
    const doc = validarIteracion(cuerpo);
    const previa = st.iteracion;
    await datos.guardarIteracion(doc);
    st.iteracion = doc;
    const nuevasDec = doc.decisiones.length > (previa.decisiones || []).length;
    const accion = nuevasDec ? 'decide' : previa.fase !== doc.fase ? 'mueve' : 'edita';
    const ultima = nuevasDec ? doc.decisiones[doc.decisiones.length - 1] : null;
    await registrar({ quien: persona, accion, objeto: 'iteracion', id: 'actual', titulo: ultima ? ultima.texto.slice(0, 120) : `Iteración ${doc.numero}`, ...(accion === 'mueve' ? { detalle: doc.fase } : {}), ...(ultima ? { detalle: ultima.tipo } : {}) });
    bump();
    return doc;
  }

  function conectarSSE(req, res, persona) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\n\n`);
    const cliente = { res, persona };
    clientes.add(cliente);
    res.write(`event: hola\ndata: ${JSON.stringify({ version: st.version })}\n\n`);
    emitir('presencia', { enLinea: enLinea() });
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* se limpia en close */ } }, 25000);
    req.on('close', () => { clearInterval(ping); clientes.delete(cliente); emitir('presencia', { enLinea: enLinea() }); });
  }

  return { st, cargar, snapshot, guardarIdea, borrarIdea, guardarTarea, borrarTarea, guardarIteracion, conectarSSE, enLinea, clientes };
}
