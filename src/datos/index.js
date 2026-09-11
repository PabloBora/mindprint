import { crearMemory } from './memory.js';

export async function crearDatos(env = process.env) {
  const backend = (env.DATA_BACKEND || 'firestore').toLowerCase();
  if (backend === 'memory') return crearMemory({ archivo: env.DATA_FILE || '' });
  if (backend === 'firestore') {
    const { crearFirestore } = await import('./firestore.js');
    return crearFirestore({ projectId: env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || '' });
  }
  throw new Error(`DATA_BACKEND desconocido: ${backend}`);
}
