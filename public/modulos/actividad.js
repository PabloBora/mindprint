/* Actividad: todo lo que pasó, por día. */
import { actividad } from '../estado.js';
import { esc, diaDe, etiquetaDia } from '../ui/base.js';
import { itemActividad } from '../ui/piezas.js';

function vista() {
  const items = actividad();
  if (!items.length) return '<div class="vacio"><b>Aún no pasa nada.</b> Aquí queda quién creó, movió o decidió qué, para no perder el hilo entre sesiones.</div>';
  let h = '<div class="feed">'; let dia = '';
  for (const a of items) { const d = diaDe(a.fecha); if (d !== dia) { dia = d; h += `<div class="day">${esc(etiquetaDia(d))}</div>`; } h += itemActividad(a); }
  return `${h}</div>`;
}
export default { id: 'actividad', titulo: 'Actividad', icono: 'actividad', orden: 7, principal: false, vista };
