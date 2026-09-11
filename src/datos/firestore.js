// Backend Firestore (modo Native). Credenciales por ADC: en Cloud Run, la cuenta del servicio.
import { Firestore } from '@google-cloud/firestore';
import { MENSAJES_MAX } from '../validar.js';

const COLS = { ideas: 'ideas', tareas: 'tareas', prospectos: 'prospectos', mensajes: 'mensajes' };

export function crearFirestore({ projectId } = {}) {
  const db = new Firestore(projectId ? { projectId } : {});
  const docIter = db.doc('iteracion/actual');
  const docAct = db.doc('actividad/reciente');
  return {
    nombre: 'firestore',
    async cargarTodo() {
      const [ideas, tareas, prospectos, mensajes, iter, act] = await Promise.all([
        db.collection(COLS.ideas).get(), db.collection(COLS.tareas).get(), db.collection(COLS.prospectos).get(),
        db.collection(COLS.mensajes).orderBy('fecha', 'desc').limit(MENSAJES_MAX).get(),
        docIter.get(), docAct.get(),
      ]);
      return {
        ideas: ideas.docs.map((d) => d.data()),
        tareas: tareas.docs.map((d) => d.data()),
        prospectos: prospectos.docs.map((d) => d.data()),
        mensajes: mensajes.docs.map((d) => d.data()).reverse(),
        iteracion: iter.exists ? iter.data() : null,
        actividad: act.exists ? (act.data().items || []) : [],
      };
    },
    async guardar(col, id, doc) { await db.collection(COLS[col]).doc(id).set(doc); },
    async borrar(col, id) { await db.collection(COLS[col]).doc(id).delete(); },
    async guardarIteracion(doc) { await docIter.set(doc); },
    async guardarActividad(items) { await docAct.set({ items }); },
  };
}
