// Backend en memoria (desarrollo y pruebas). Con DATA_FILE persiste en un JSON local.
import fs from 'node:fs';

export function crearMemory({ archivo = '' } = {}) {
  let data = { ideas: {}, tareas: {}, iteracion: null, actividad: [] };
  if (archivo && fs.existsSync(archivo)) {
    try { data = { ...data, ...JSON.parse(fs.readFileSync(archivo, 'utf8')) }; } catch { /* archivo corrupto: se ignora */ }
  }
  const persistir = () => { if (archivo) fs.writeFileSync(archivo, JSON.stringify(data, null, 2)); };
  return {
    nombre: 'memory',
    async cargarTodo() {
      return { ideas: Object.values(data.ideas), tareas: Object.values(data.tareas), iteracion: data.iteracion, actividad: data.actividad };
    },
    async guardar(col, id, doc) { data[col][id] = structuredClone(doc); persistir(); },
    async borrar(col, id) { delete data[col][id]; persistir(); },
    async guardarIteracion(doc) { data.iteracion = structuredClone(doc); persistir(); },
    async guardarActividad(items) { data.actividad = structuredClone(items); persistir(); },
  };
}
