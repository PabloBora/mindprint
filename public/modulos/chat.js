/* Chat del equipo; también procesa los comentarios (mensajes con referencia) de los paneles. */
import { S, mensajes, noLeidos } from '../estado.js';
import { esc, icono, diaDe, etiquetaDia } from '../ui/base.js';
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
    if (!sep && m.quien !== (S.yo && S.yo.persona) && String(m.fecha) > String(S.leidoAlAbrir || '')) { sep = true; h += '<div class="day">No leídos</div>'; }
    h += itemMsg(m, false);
  }
  h += `</div><form class="composer" data-submit="add-msg"><textarea class="in" id="chat-new" data-keep="chat-new" rows="2" placeholder="Escribe al equipo. Enter envía, Shift+Enter salto de línea. @pablo @max @daniel para mencionar." maxlength="1000"></textarea><button class="btn primary" type="submit">${icono('enviar')}Enviar</button></form></div>`;
  return h;
}
function alMostrar() {
  if (S.leidoAlAbrir == null) S.leidoAlAbrir = S.leido;
  marcarLeido();
  const log = document.getElementById('chat-log'); if (!log) return;
  log.scrollTop = abajo ? log.scrollHeight : scrollPrev;
  log.addEventListener('scroll', () => { abajo = log.scrollHeight - log.scrollTop - log.clientHeight < 80; scrollPrev = log.scrollTop; });
}
export default {
  id: 'chat', titulo: 'Chat', icono: 'chat', orden: 5, principal: true,
  badge: () => (noLeidos() ? String(noLeidos()) : ''), hot: () => noLeidos() > 0,
  vista, alMostrar,
  alSalir: () => { S.leidoAlAbrir = null; },
  acciones: { 'del-msg': async (el) => { await borrarMensaje(el.dataset.id); } },
  submits: {
    'add-msg': async (form) => {
      const ta = form.querySelector('textarea'); const texto = (ta.value || '').trim(); if (!texto) return;
      const ref = form.dataset.refTipo ? { tipo: form.dataset.refTipo, id: form.dataset.refId } : null;
      ta.value = '';
      const ok = await enviarMensaje(texto, ref); if (!ok) ta.value = texto; else abajo = true;
    },
  },
};
