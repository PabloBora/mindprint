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
    /** Quita una operación que ya no debe enviarse (p. ej. se borró un mensaje que aún no salía). */
    quitar(clave) { const antes = items.length; items = items.filter((o) => o.clave !== clave); if (items.length !== antes) persistir(); return items.length !== antes; },
    tiene(clave) { return items.some((o) => o.clave === clave); },
    /** Envía en orden con `enviar(op) → Promise<boolean>`: `false` = fallo de red (se detiene y conserva lo que falta);
        una excepción se propaga tal cual (no se confunde con un fallo de red). */
    async vaciar(enviar) {
      while (items.length) { const op = items[0]; const ok = await enviar(op); if (!ok) return false; items.shift(); persistir(); }
      return true;
    },
    limpiar() { items = []; persistir(); },
  };
}
/** Un error de red (sin respuesta del servidor), a diferencia de un 4xx/5xx que sí respondió. */
export const esErrorDeRed = (e) => !!e && (e.code === 'red' || e.name === 'TypeError' || /Failed to fetch|Load failed|NetworkError|network/i.test(String(e.message || '')));
