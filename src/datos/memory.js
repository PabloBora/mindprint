// Backend en memoria (desarrollo y pruebas). Con DATA_FILE persiste en un JSON local.
import fs from 'node:fs';
import { MENSAJES_MAX } from '../validar.js';

export function crearMemory({ archivo = '' } = {}) {
  let data = { ideas: {}, tareas: {}, prospectos: {}, mensajes: {}, iteracion: null, actividad: [] };
  if (archivo && fs.existsSync(archivo)) {
    try { data = { ...data, ...JSON.parse(fs.readFileSync(archivo, 'utf8')) }; } catch { /* archivo corrupto: se ignora */ }
  }
  const persistir = () => { if (archivo) fs.writeFileSync(archivo, JSON.stringify(data, null, 2)); };
  return {
    nombre: 'memory',
    async cargarTodo() {
      const mensajes = Object.values(data.mensajes || {}).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(-MENSAJES_MAX);
      return { ideas: Object.values(data.ideas), tareas: Object.values(data.tareas), prospectos: Object.values(data.prospectos || {}), mensajes, iteracion: data.iteracion, actividad: data.actividad };
    },
    async guardar(col, id, doc) { if (!data[col]) data[col] = {}; data[col][id] = structuredClone(doc); persistir(); },
    async borrar(col, id) { if (data[col]) delete data[col][id]; persistir(); },
    async guardarIteracion(doc) { data.iteracion = structuredClone(doc); persistir(); },
    async guardarActividad(items) { data.actividad = structuredClone(items); persistir(); },
  };
}
