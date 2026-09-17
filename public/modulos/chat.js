/* Chat del equipo; también procesa los comentarios (mensajes con referencia) de los paneles. */
import { S, mensajes, noLeidos } from '../estado.js';
import { rutaDe, reemplazar } from '../ruta.js';
import { esc, icono, diaDe, etiquetaDia, confirmar, toast } from '../ui/base.js';
import { itemMsg } from '../ui/piezas.js';
import { enviarMensaje, borrarMensaje, marcarLeido } from '../api.js';

let abajo = true; let scrollPrev = 0;
function vista() {
  const items = mensajes();
  let h = '<div class="chat"><div class="chat-log" id="chat-log">';
  if (!items.length) h += '<div class="vacio"><b>Todavía nadie escribe.</b> Este chat es de los tres. Los comentarios que dejen en una tarea, una oportunidad o un usuario de prueba también aparecen aquí, con su referencia.</div>';
  let dia = ''; let sep = false;
  for (const m of items) {
    const d = diaDe(m.fecha); if (d !== dia) { dia = d; h += `<div class="day">${esc(etiquetaDia(d))}</div>`; }
    if (!sep && m.quien !== (S.yo && S.yo.persona) && String(m.fecha) > String(S.leidoAlAbrir || '')) { sep = true; h += '<div class="day no-leidos">No leídos</div>'; }
    h += itemMsg(m, false);
  }
  h += `</div><form class="composer" data-submit="add-msg"><textarea class="in" id="chat-new" data-keep="chat-new" rows="2" placeholder="Escribe al equipo · @max, @daniel o @pablo para mencionar" maxlength="1000" aria-describedby="chat-ayuda"></textarea><button class="btn primary" type="submit">${icono('enviar')}<span>Enviar</span></button><span class="composer-ayuda solo-escritorio" id="chat-ayuda">Enter envía · Shift+Enter hace salto de línea</span></form></div>`;
  return h;
}
function alMostrar() {
  if (S.leidoAlAbrir == null) S.leidoAlAbrir = S.leido;
  marcarLeido();
  const log = document.getElementById('chat-log'); if (!log) return;
  if (S.ruta.id) { // llegar desde la búsqueda global a un mensaje concreto
    const el = log.querySelector(`[data-msg="${CSS.escape(S.ruta.id)}"]`);
    if (el) { S.resaltado = S.ruta.id; el.scrollIntoView({ block: 'center' }); abajo = false; scrollPrev = log.scrollTop; }
    reemplazar(rutaDe('chat')); return;
  }
  log.scrollTop = abajo ? log.scrollHeight : scrollPrev;
  log.addEventListener('scroll', () => { abajo = log.scrollHeight - log.scrollTop - log.clientHeight < 80; scrollPrev = log.scrollTop; });
}
export default {
  id: 'chat', titulo: 'Chat', icono: 'chat', orden: 5, principal: true,
  badge: () => (noLeidos() ? String(noLeidos()) : ''), hot: () => noLeidos() > 0,
  vista, alMostrar,
  alSalir: () => { S.leidoAlAbrir = null; S.resaltado = ''; },
  acciones: {
    // Sin Deshacer: reenviar el texto crearía un mensaje nuevo con otra hora y otro orden.
    'del-msg': async (el) => { if (!(await confirmar({ titulo: 'Borrar tu mensaje', texto: 'Se borra para los tres y no se puede deshacer.', ok: 'Borrar', peligro: true }))) return; if (await borrarMensaje(el.dataset.id)) toast('Mensaje borrado'); },
  },
  submits: {
    'add-msg': async (form) => {
      const ta = form.querySelector('textarea'); const texto = (ta.value || '').trim(); if (!texto) return;
      const ref = form.dataset.refTipo ? { tipo: form.dataset.refTipo, id: form.dataset.refId } : null;
      ta.value = '';
      const ok = await enviarMensaje(texto, ref); if (!ok) ta.value = texto; else abajo = true;
    },
  },
};
