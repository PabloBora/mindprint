/* Cola de escrituras pendientes (sin red). Pura: recibe el storage por inyección y se prueba en Node. */
export function crearCola({ storage = null, clave = 'mp.cola' } = {}) {
  let items = leer();
  function leer() { try { const v = storage && storage.getItem(clave); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; } catch { return []; } }
  function persistir() { try { if (storage) storage.setItem(clave, JSON.stringify(items)); } catch { /* sin storage */ } }
  return {
    get largo() { return items.length; },
    get items() { return items.slice(); },
    /** Una operación por clave (la última gana): {clave, metodo, ruta, cuerpo}. */
    agregar(op) { items = items.filter((o) => o.clave !== op.clave); items.push({ ...op, ts: Date.now() }); persistir(); },
    /** Envía en orden con `enviar(op) → Promise<boolean>`; se detiene en el primer fallo de red y conserva lo que falta. */
    async vaciar(enviar) {
      while (items.length) { const op = items[0]; let ok = false; try { ok = await enviar(op); } catch { ok = false; } if (!ok) return false; items.shift(); persistir(); }
      return true;
    },
    limpiar() { items = []; persistir(); },
  };
}
/** Un error de red (sin respuesta del servidor), a diferencia de un 4xx/5xx que sí respondió. */
export const esErrorDeRed = (e) => !!e && (e.code === 'red' || e.name === 'TypeError' || /Failed to fetch|Load failed|NetworkError|network/i.test(String(e.message || '')));
