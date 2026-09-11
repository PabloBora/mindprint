#!/usr/bin/env node
// Importa un JSON {ideas:[], tareas:[], iteracion:{}, actividad:[]} al backend configurado.
// Uso: DATA_BACKEND=firestore GOOGLE_CLOUD_PROJECT=<id> node scripts/importar.mjs datos.json
import fs from 'node:fs';
import { crearDatos } from '../src/datos/index.js';
import { validarIdea, validarTarea, validarProspecto, validarIteracion, validarMensaje, idValido } from '../src/validar.js';
const ruta = process.argv[2];
if (!ruta) { console.error('uso: node scripts/importar.mjs <archivo.json>'); process.exit(1); }
const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const datos = await crearDatos(process.env);
const ahora = new Date().toISOString();
let n = 0;
for (const i of j.ideas || []) { const d = validarIdea(i); await datos.guardar('ideas', d.id, { ...d, creado: d.creado || ahora, actualizado: i.actualizado || ahora, actualizadoPor: i.actualizadoPor || '' }); n++; }
for (const t of j.tareas || []) { const d = validarTarea(t); await datos.guardar('tareas', d.id, { ...d, creado: d.creado || ahora, actualizado: t.actualizado || ahora, actualizadoPor: t.actualizadoPor || '' }); n++; }
for (const p of j.prospectos || []) { const d = validarProspecto(p); await datos.guardar('prospectos', d.id, { ...d, creado: d.creado || ahora, actualizado: p.actualizado || ahora, actualizadoPor: p.actualizadoPor || '' }); n++; }
let omitidos = 0;
for (const m of j.mensajes || []) {
  // Un mensaje corrupto se omite y se cuenta; nunca tumba el resto de la importación.
  try {
    if (!m || !m.id || !m.fecha || !m.quien) throw new Error('sin id, fecha o quien');
    const fecha = new Date(m.fecha); if (Number.isNaN(fecha.getTime())) throw new Error('fecha inválida');
    const limpio = validarMensaje(m); // texto y ref con las mismas reglas que el API
    await datos.guardar('mensajes', idValido(m.id), { id: m.id, fecha: fecha.toISOString(), quien: m.quien, texto: limpio.texto, ref: limpio.ref }); n++;
  } catch (e) { omitidos++; console.warn(`mensaje omitido (${m && m.id ? m.id : '?'}): ${e.message}`); }
}
if (j.iteracion) { await datos.guardarIteracion(validarIteracion(j.iteracion)); n++; }
if (Array.isArray(j.actividad)) { await datos.guardarActividad(j.actividad.slice(0, 100)); }
console.log(`importados ${n} documentos en backend ${datos.nombre}${omitidos ? ` · ${omitidos} mensaje(s) omitido(s)` : ''}`);
