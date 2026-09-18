/* Ajustes: tu cuenta, apariencia, avisos, iteración, equipo y la app. Las preferencias son de este navegador. */
import { S, P, yo, nombre, iteracion, semanasDe, lsSet } from '../estado.js';
import { esc, icono, avatar, bus, confirmar, toast, sonar } from '../ui/base.js';
import { cola } from '../api.js';

const seg = (act, actual, opciones) => `<div class="seg">${opciones.map(([k, n]) => `<button type="button" data-act="${act}" data-v="${k}" aria-pressed="${actual === k}">${n}</button>`).join('')}</div>`;

function vista() {
  const me = yo(); const it = iteracion(); const cx = { live: 'en vivo', poll: 'actualizando cada 10 s', bad: 'sin conexión', conectando: 'conectando…' }[S.conexion] || '';
  return `<div class="ajustes">
    <section class="box"><h2>Tu cuenta</h2>
      <div class="persona-row">${avatar(me, 'lg')}<div><div class="nom">${esc(nombre(me))}</div><div class="hint">${esc((P()[me] || {}).rol || '')}</div></div></div>
      <p class="hint">Entraste con tu liga personal. La sesión dura 90 días en este navegador; si vence, vuelve a abrir tu liga.</p>
      <div><a class="btn" href="/salir" data-act="salir">${icono('salir', 'sm')}Salir de este navegador</a></div></section>
    <section class="box"><h2>Apariencia</h2>
      <div class="field"><label>Tema</label>${seg('tema', S.tema, [['auto', 'Del sistema'], ['light', 'Claro'], ['dark', 'Oscuro']])}</div>
      <div class="field"><label>Tamaño de letra</label>${seg('letra', S.letra, [['normal', 'Normal'], ['grande', 'Grande']])}</div></section>
    <section class="box"><h2>Avisos</h2>
      <div class="field"><label>Sonido cuando llega un mensaje</label>${seg('sonido', S.sonido ? 'si' : 'no', [['si', 'Sí'], ['no', 'No']])}</div>
      <p class="hint">Suena solo con mensajes de los otros dos y cuando no estás viendo el chat. Algunos navegadores piden que antes toques la página una vez.</p>
      <div><button type="button" class="btn sm" data-act="probar-sonido">Probar el sonido</button></div></section>
    <section class="box"><h2>Iteración</h2>
      <div class="datos"><div class="field"><label>Número de iteración</label><input class="in" type="number" min="1" data-bind="iter:actual:numero" value="${esc(it.numero || 1)}"></div>
      <div class="field"><label>Semanas (4–8)</label><input class="in" type="number" min="4" max="8" data-bind="iter:actual:semanas" value="${esc(semanasDe(it))}"></div></div>
      <p class="hint">Fechas, sincronía, canal y dedicación están en <a href="#/iteracion">Iteración</a>. Esto lo ven los tres.</p></section>
    <section class="box"><h2>El equipo</h2>${Object.keys(P()).map((p) => `<div class="persona-row">${avatar(p, S.enLinea.includes(p) || p === me ? '' : 'off')}<div><div class="nom">${esc(nombre(p))}${p === me ? '<span class="tag">tú</span>' : S.enLinea.includes(p) ? '<span class="pill ok">en línea</span>' : ''}</div><div class="hint">${esc(P()[p].rol)}</div></div></div>`).join('')}</section>
    <section class="box"><h2>La app</h2>
      <div class="hint">Conexión: <b>${esc(cx)}</b>${cola.largo ? ` · <b>${cola.largo}</b> cambio${cola.largo === 1 ? '' : 's'} por enviar` : ''}${S.version ? ` · versión <span class="mono">${esc(S.version)}</span>` : ''}</div>
      <p class="hint">Para tenerla como app: en Android, menú del navegador → «Añadir a pantalla de inicio»; en iPhone, Compartir → «Agregar a inicio».</p>
      <div class="acciones-fila"><button type="button" class="btn sm" data-act="ayuda">${icono('ayuda', 'sm')}Ayuda y atajos</button><button type="button" class="btn sm" data-act="reset-prefs">Restablecer preferencias de este navegador</button></div></section>
  </div>`;
}

export default {
  id: 'ajustes', titulo: 'Ajustes', icono: 'ajustes', orden: 8, principal: false,
  vista,
  acciones: {
    'letra': (el) => { S.letra = el.dataset.v === 'grande' ? 'grande' : 'normal'; lsSet('mp.letra', S.letra); bus.emit('prefs'); },
    'sonido': (el) => { S.sonido = el.dataset.v === 'si'; lsSet('mp.sonido', S.sonido ? 'si' : 'no'); if (S.sonido) sonar(); bus.emit('prefs'); },
    'probar-sonido': () => { if (!sonar()) toast('Este navegador no permite sonidos aquí.'); },
    'reset-prefs': async () => {
      if (!(await confirmar({ titulo: 'Restablecer preferencias', texto: 'Vuelven a su valor inicial el tema, la letra, el sonido y los filtros de los tableros en este navegador. Tus datos y los cambios por enviar no se tocan.', ok: 'Restablecer' }))) return;
      for (const k of ['mp.tema', 'mp.letra', 'mp.sonido', 'mp.filtros', 'mp.f.tareas.resp']) { try { globalThis.localStorage && globalThis.localStorage.removeItem(k); } catch { /* sin storage */ } }
      bus.emit('prefs', { reset: true }); toast('Preferencias restablecidas');
    },
  },
};
