// Estado del tablero: caché en memoria + versión + avisos en vivo (SSE) + presencia + actividad.
// Todas las escrituras pasan por aquí y se ejecutan EN SERIE (un solo contenedor: max-instances 1),
// así el tope de votos y la caché nunca se cruzan entre peticiones concurrentes.
import crypto from 'node:crypto';
import { PERSONAS } from './auth.js';
import { validarIdea, validarTarea, validarProspecto, validarIteracion, validarMensaje, iteracionInicial, VOTOS_MAX, MENSAJES_MAX, ErrorConflicto, ErrorValidacion, ErrorProhibido } from './validar.js';

const ACTIVIDAD_MAX = 100;
const ahora = () => new Date().toISOString();
const nuevoId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);

export function crearEstado(datos) {
  // `version` es un marcador de "algo cambió". Arranca en Date.now() para que un reinicio o
  // redeploy nunca la haga bajar; los clientes comparan con !== (no confíes en +1 exacto).
  const st = { version: Date.now(), ideas: new Map(), tareas: new Map(), prospectos: new Map(), mensajes: [], iteracion: iteracionInicial(), actividad: [], cargado: false };
  const clientes = new Set(); // { res, persona }
  let cola = Promise.resolve();
  const enSerie = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  // Al cargar, cada documento pasa por su validador: así lo guardado por versiones anteriores
  // (etapas, criterios o artefactos viejos) llega al cliente ya migrado. Un doc corrupto se omite.
  function normalizar(lista, validar) {
    const out = new Map();
    for (const d of Array.isArray(lista) ? lista : []) {
      if (!d || !d.id) continue;
      try { out.set(d.id, { ...validar(d), creado: d.creado || '', actualizado: d.actualizado || '', actualizadoPor: d.actualizadoPor || '' }); }
      catch (e) { console.error(`documento omitido al cargar (${d.id}): ${e.message}`); }
    }
    return out;
  }
  async function cargar() {
    const t = await datos.cargarTodo();
    st.ideas = normalizar(t.ideas, validarIdea);
    st.tareas = normalizar(t.tareas, validarTarea);
    st.prospectos = normalizar(t.prospectos, validarProspecto);
    st.iteracion = t.iteracion ? validarIteracion(t.iteracion) : iteracionInicial();
    st.actividad = Array.isArray(t.actividad) ? t.actividad.slice(0, ACTIVIDAD_MAX) : [];
    st.mensajes = (Array.isArray(t.mensajes) ? t.mensajes : []).filter((d) => d && d.id && d.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(-MENSAJES_MAX);
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
      prospectos: [...st.prospectos.values()],
      mensajes: st.mensajes,
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
      if (otros + propios > VOTOS_MAX) throw new ErrorConflicto('sin_votos', `${PERSONAS[p].nombre} ya no tiene votos (máximo ${VOTOS_MAX})`);
    }
  }

  const guardarIdea = (cuerpo, persona) => enSerie(async () => {
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
  });
  const borrarIdea = (id, persona) => enSerie(async () => {
    const previa = st.ideas.get(id);
    if (!previa) return false;
    await datos.borrar('ideas', id);
    st.ideas.delete(id);
    await registrar({ quien: persona, accion: 'borra', objeto: 'idea', id, titulo: previa.titulo });
    bump();
    return true;
  });
  const guardarTarea = (cuerpo, persona) => enSerie(async () => {
    const limpia = validarTarea(cuerpo);
    const previa = st.tareas.get(limpia.id);
    const doc = { ...limpia, creado: previa?.creado || limpia.creado || ahora(), actualizado: ahora(), actualizadoPor: persona };
    await datos.guardar('tareas', doc.id, doc);
    st.tareas.set(doc.id, doc);
    const accion = !previa ? 'crea' : previa.estado !== doc.estado ? 'mueve' : 'edita';
    await registrar({ quien: persona, accion, objeto: 'tarea', id: doc.id, titulo: doc.titulo, ...(accion === 'mueve' ? { detalle: doc.estado } : {}) });
    bump();
    return doc;
  });
  const borrarTarea = (id, persona) => enSerie(async () => {
    const previa = st.tareas.get(id);
    if (!previa) return false;
    await datos.borrar('tareas', id);
    st.tareas.delete(id);
    await registrar({ quien: persona, accion: 'borra', objeto: 'tarea', id, titulo: previa.titulo });
    bump();
    return true;
  });
  const guardarProspecto = (cuerpo, persona) => enSerie(async () => {
    const limpio = validarProspecto(cuerpo);
    const previo = st.prospectos.get(limpio.id);
    const doc = { ...limpio, creado: previo?.creado || limpio.creado || ahora(), actualizado: ahora(), actualizadoPor: persona };
    await datos.guardar('prospectos', doc.id, doc);
    st.prospectos.set(doc.id, doc);
    const accion = !previo ? 'crea' : previo.etapa !== doc.etapa ? 'mueve' : 'edita';
    await registrar({ quien: persona, accion, objeto: 'prospecto', id: doc.id, titulo: doc.empresa, ...(accion === 'mueve' ? { detalle: doc.etapa } : {}) });
    bump();
    return doc;
  });
  const borrarProspecto = (id, persona) => enSerie(async () => {
    const previo = st.prospectos.get(id);
    if (!previo) return false;
    await datos.borrar('prospectos', id);
    st.prospectos.delete(id);
    await registrar({ quien: persona, accion: 'borra', objeto: 'prospecto', id, titulo: previo.empresa });
    bump();
    return true;
  });
  const guardarIteracion = (cuerpo, persona) => enSerie(async () => {
    const doc = validarIteracion(cuerpo);
    const previa = st.iteracion;
    await datos.guardarIteracion(doc);
    st.iteracion = doc;
    const nuevasDec = doc.decisiones.length > (previa.decisiones || []).length;
    const accion = nuevasDec ? 'decide' : previa.fase !== doc.fase ? 'mueve' : 'edita';
    const ultima = nuevasDec ? doc.decisiones[doc.decisiones.length - 1] : null;
    const detalle = ultima ? ultima.tipo : accion === 'mueve' ? doc.fase : undefined;
    await registrar({ quien: persona, accion, objeto: 'iteracion', id: 'actual', titulo: ultima ? ultima.texto.slice(0, 120) : `Iteración ${doc.numero}`, ...(detalle ? { detalle } : {}) });
    bump();
    return doc;
  });

  const guardarMensaje = (cuerpo, persona) => enSerie(async () => {
    const limpio = validarMensaje(cuerpo);
    if (limpio.ref) {
      const item = limpio.ref.tipo === 'idea' ? st.ideas.get(limpio.ref.id) : limpio.ref.tipo === 'tarea' ? st.tareas.get(limpio.ref.id) : st.prospectos.get(limpio.ref.id);
      if (!item) throw new ErrorValidacion('ref_invalida', 'La referencia apunta a algo que ya no existe');
      limpio.ref.titulo = String(item.titulo || item.empresa || '').slice(0, 160);
    }
    const doc = { id: nuevoId(), fecha: ahora(), quien: persona, texto: limpio.texto, ref: limpio.ref };
    await datos.guardar('mensajes', doc.id, doc);
    st.mensajes.push(doc);
    if (st.mensajes.length > MENSAJES_MAX) st.mensajes.splice(0, st.mensajes.length - MENSAJES_MAX);
    bump();
    return doc;
  });
  const borrarMensaje = (id, persona) => enSerie(async () => {
    const i = st.mensajes.findIndex((m) => m.id === id);
    if (i < 0) return false;
    if (st.mensajes[i].quien !== persona) throw new ErrorProhibido('ajeno', 'Solo quien escribió el mensaje puede borrarlo');
    await datos.borrar('mensajes', id);
    st.mensajes.splice(i, 1);
    bump();
    return true;
  });

  function conectarSSE(req, res, persona) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const cliente = { res, persona };
    clientes.add(cliente);
    res.write(`event: hola\ndata: ${JSON.stringify({ version: st.version })}\n\n`);
    emitir('presencia', { enLinea: enLinea() });
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* se limpia en close */ } }, 25000);
    req.on('close', () => { clearInterval(ping); clientes.delete(cliente); emitir('presencia', { enLinea: enLinea() }); });
  }

  return { st, cargar, snapshot, guardarIdea, borrarIdea, guardarTarea, borrarTarea, guardarProspecto, borrarProspecto, guardarIteracion, guardarMensaje, borrarMensaje, conectarSSE, enLinea };
}
