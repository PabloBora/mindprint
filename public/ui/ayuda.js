/* Panel de ayuda (?): qué es cada pestaña, atajos y cómo se guarda. Puro, sin DOM. */
import { esc, icono } from './base.js';

const PESTANAS = [
  ['hoy', 'Hoy', 'Tu centro de trabajo: la iteración, lo tuyo, el equipo y lo pendiente de la fase.'],
  ['tareas', 'Tareas', 'Tablero por estado. Arrastra entre columnas o usa el botón de mover; cada tarea tiene responsable, fase y fecha.'],
  ['usuarios', 'Usuarios de prueba', 'Gente cercana con la que validamos. Etapas de candidato a «jala» y las cinco señales de tracción.'],
  ['oportunidades', 'Oportunidades', 'Procesos que valdría automatizar. Cuatro criterios, tres votos por persona y reacciones.'],
  ['chat', 'Chat', 'Conversación de los tres. Los comentarios en una tarjeta también salen aquí, con su referencia.'],
  ['iteracion', 'Iteración', 'Fase, fechas, entregables de cada fase y las decisiones de cierre.'],
  ['actividad', 'Actividad', 'Todo lo que hicieron los tres, en orden.'],
];
const ATAJOS = [
  ['/', 'Buscar en todo (tareas, usuarios, oportunidades y mensajes)'],
  ['n', 'Nuevo en la pestaña actual'],
  ['g h', 'Ir a Hoy · también g t, g u, g o, g c, g i, g a'],
  ['Esc', 'Cerrar panel, menú o búsqueda'],
  ['Enter', 'Enviar mensaje o comentario (Shift+Enter, salto de línea)'],
  ['?', 'Esta ayuda'],
];
export function panelAyuda(version = '') {
  const html = `<div class="ayuda">
    <section><h3>Pestañas</h3><div class="lista-ayuda">${PESTANAS.map(([ic, n, d]) => `<div class="fila">${icono(ic)}<div><b>${esc(n)}</b><span>${esc(d)}</span></div></div>`).join('')}</div></section>
    <section><h3>Atajos de teclado</h3><div class="atajos">${ATAJOS.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`).join('')}</div></section>
    <section><h3>Cómo se guarda</h3><div class="texto">
      <p>Cada cambio se guarda solo, al momento; los otros dos lo ven en vivo. La cabecera dice «guardando…» y «guardado».</p>
      <p>Sin conexión, la app sigue abriendo con la última copia. Lo que cambies se guarda en este navegador y se envía cuando vuelva la red; verás «N por enviar» en la cabecera.</p>
      <p>Al salir una versión nueva del tablero aparece un aviso para actualizar. En el teléfono puedes instalarla: «Añadir a pantalla de inicio».</p>
    </div></section>
    <section><h3>Dónde está lo demás</h3><div class="texto"><p>Los Docs (Plan Maestro, Mindprint en una página, minutas) viven en la <a href="https://drive.google.com/drive/folders/1RiT2jf0FVqJdx-KTnQBxuYEWU7-CnKW-" target="_blank" rel="noopener">carpeta Mindprint de Drive</a>.</p>${version ? `<p class="tag">versión ${esc(version)}</p>` : ''}</div></section>
  </div>`;
  return { titulo: 'Ayuda y atajos', html };
}
