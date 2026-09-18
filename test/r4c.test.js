/* R4c: filtros que se recuerdan, orden, columnas plegables, Hoy como panel, menciones, línea de tiempo, actividad y Ajustes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, leerFiltros, guardarFiltros, ordenar } from '../public/estado.js';

const base = () => ({
  version: 1, yo: { persona: 'pablo' }, personas: { pablo: { nombre: 'Pablo', rol: 'T' }, max: { nombre: 'Max', rol: 'P' }, daniel: { nombre: 'Daniel', rol: 'M' } },
  ideas: [{ id: 'a', titulo: 'Beta', etapa: 'semilla', votos: { max: 1 }, criterios: { comun: 2 }, actualizado: '2026-09-01' }, { id: 'b', titulo: 'Alfa', etapa: 'semilla', votos: {}, criterios: { comun: 2, dolor: 2 }, actualizado: '2026-09-10' }],
  tareas: [], prospectos: [], mensajes: [], actividad: [], enLinea: [],
  iteracion: { numero: 1, fase: 'entender', semanas: 6, inicio: '', demo: '', artefactos: { oportunidad: { hecho: true } }, decisiones: [], dedicacion: {} },
});
const ymd = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tarea = (id, vence, extra = {}) => ({ id, titulo: `T ${id}`, detalle: '', motivo: '', responsable: 'pablo', fase: 'general', estado: 'pendiente', vence, ideaId: '', creado: `2026-09-0${id.length}`, ...extra });

test('filtros: se guardan como JSON sin lo pasajero y se vuelven a leer igual', () => {
  const mem = new Map(); const get = (k, d) => (mem.has(k) ? mem.get(k) : d); const set = (k, v) => mem.set(k, v);
  S.f = leerFiltros(get); S.f.tareas.resp = 'max'; S.f.tareas.verHechas = true; S.f.tareas.colapsadas = ['hecha']; S.f.actividad.tipo = 'idea';
  guardarFiltros(set); const g = JSON.parse(mem.get('mp.filtros'));
  assert.equal(g.tareas.resp, 'max'); assert.equal(g.tareas.verHechas, false, '«ver todas» no se recuerda'); assert.ok(!('q' in g.oportunidades), 'la búsqueda no se guarda');
  const otra = leerFiltros(get); assert.deepEqual(otra.tareas.colapsadas, ['hecha']); assert.equal(otra.actividad.tipo, 'idea');
  S.f = leerFiltros(() => null);
});

test('orden de tableros: por fecha, recientes, título, votos y criterios', () => {
  S.estado = base(); S.yo = S.estado.yo;
  const ts = [tarea('1', '2026-10-05', { titulo: 'zeta', actualizado: '2026-09-01' }), tarea('22', '2026-09-20', { titulo: 'Árbol', actualizado: '2026-09-15' }), tarea('333', '', { titulo: 'medio', actualizado: '2026-09-10' })];
  assert.deepEqual(ordenar('tareas', ts, 'vence').map((t) => t.id), ['22', '1', '333'], 'por fecha; sin fecha al final');
  assert.deepEqual(ordenar('tareas', ts, 'recientes').map((t) => t.id), ['22', '333', '1']);
  assert.deepEqual(ordenar('tareas', ts, 'titulo').map((t) => t.titulo), ['Árbol', 'medio', 'zeta'], 'orden alfabético en español, sin importar acentos');
  assert.deepEqual(ordenar('oportunidades', S.estado.ideas, 'votos').map((i) => i.id), ['a', 'b']);
  assert.deepEqual(ordenar('oportunidades', S.estado.ideas, 'criterios').map((i) => i.id), ['b', 'a']);
  assert.notStrictEqual(ordenar('tareas', ts, 'vence'), ts, 'no muta la lista original');
});

test('columnas plegables: la columna plegada conserva sus tarjetas (el teléfono las muestra) y el tablero la angosta', async () => {
  const { colTablero, columnasGrid } = await import('../public/ui/piezas.js');
  const h = colTablero({ tablero: 'tareas', kind: 'tarea', k: 'hecha', label: 'Hecha', total: 2, cards: '<div class="card">x</div>', activa: false, plegada: true });
  assert.match(h, /class="col plegada"/); assert.match(h, /aria-expanded="false"/); assert.match(h, /data-act="colapsar" data-tablero="tareas" data-col="hecha"/); assert.ok(h.includes('<div class="card">x</div>'));
  assert.equal(columnasGrid(['a', 'b', 'c'], ['b']), 'minmax(0,1fr) 44px minmax(0,1fr)');
  S.estado = base(); S.yo = S.estado.yo; S.f = leerFiltros(() => null); S.f.tareas.colapsadas = ['hecha']; S.q = '';
  S.estado.tareas = [tarea('1', ''), tarea('22', '', { estado: 'hecha' })];
  const v = (await import('../public/modulos/tareas.js')).default.vista();
  assert.match(v, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) minmax\(0,1fr\) 44px/); assert.match(v, /data-filtro="orden"/);
  S.f.tareas.colapsadas = [];
});

test('Hoy: «mi día» agrupa por vencimiento, muestra lo urgente completo y resume el resto', async () => {
  const hoy = (await import('../public/modulos/hoy.js'));
  S.estado = base(); S.yo = S.estado.yo; S.enLinea = [];
  assert.equal(hoy.grupoDe(tarea('1', ymd(-2))), 'vencidas'); assert.equal(hoy.grupoDe(tarea('1', ymd(0))), 'hoy'); assert.equal(hoy.grupoDe(tarea('1', ymd(5))), 'semana'); assert.equal(hoy.grupoDe(tarea('1', ymd(30))), 'luego'); assert.equal(hoy.grupoDe(tarea('1', '')), 'sin');
  S.estado.tareas = [tarea('v', ymd(-1)), tarea('h', ymd(0)), ...Array.from({ length: 12 }, (_, i) => tarea(`s${i}`, ''))];
  const h = hoy.default.vista();
  assert.ok(h.indexOf('grupo-t vencidas') < h.indexOf('grupo-t hoy') && h.indexOf('grupo-t hoy') < h.indexOf('grupo-t sin'), 'vencidas, hoy y luego sin fecha');
  assert.match(h, /data-act="ver-mias">y 4 más en Tareas</, '10 a la vista, el resto se resume');
  assert.match(h, /<b>1<\/b> de 9 entregables de la iteración/);
  assert.match(h, /class="box caja-chat"/); assert.match(h, /Chat <span class="n">al día/);
  const orden = ['caja-mio', 'caja-fase', 'caja-chat', 'caja-usuarios', 'caja-equipo', 'caja-movs'].map((c) => h.indexOf(c));
  assert.deepEqual(orden, orden.slice().sort((a, b) => a - b), 'el orden del documento es el que se ve en el teléfono');
  S.estado.mensajes = [{ id: 'm1', fecha: '2026-09-17T10:00:00Z', quien: 'max', texto: 'oye @pablo', ref: null }, { id: 'm2', fecha: '2026-09-17T10:01:00Z', quien: 'pablo', texto: 'mío', ref: null }]; S.leido = '';
  const c = hoy.default.vista(); assert.match(c, /1 sin leer · 1 te menciona/); assert.ok(!c.includes('data-act="del-msg"'), 'en Hoy no se borra');
});

test('menciones: son botones que llevan a las tareas de la persona y la mía se resalta', async () => {
  const { formatoMensaje } = await import('../public/ui/piezas.js');
  S.estado = base(); S.yo = S.estado.yo;
  const h = formatoMensaje('hola @Max y @pablo, escribe a pablo@correo.com');
  assert.match(h, /<button type="button" class="mention" data-act="mencion" data-p="max" title="Ver las tareas de Max">@Max<\/button>/);
  assert.match(h, /class="mention me" data-act="mencion" data-p="pablo"/);
  assert.ok(h.includes('pablo@correo.com') && !/data-p="correo"/.test(h), 'un correo no es mención');
  assert.equal(typeof (await import('../public/modulos/chat.js')).default.acciones.mencion, 'function');
  // una mención dentro de una URL no mete un botón en el enlace; la URL queda completa y la mención de afuera sigue siendo botón
  const u = formatoMensaje('mira https://x.com/@pablo/status/1, @max');
  assert.ok(u.includes('<a href="https://x.com/@pablo/status/1" target="_blank" rel="noopener">https://x.com/@pablo/status/1</a>,'), u);
  assert.equal((u.match(/<button/g) || []).length, 1); assert.match(u, /data-p="max"/);
  assert.doesNotMatch(u, /href="[^"]*</, 'ningún atributo href contiene etiquetas');
  assert.match(formatoMensaje('ver https://a.com/x?y=1&z=2.'), /<a href="https:\/\/a\.com\/x\?y=1&amp;z=2" target="_blank" rel="noopener">https:\/\/a\.com\/x\?y=1&amp;z=2<\/a>\./, 'se escapa y el punto final queda fuera del enlace');
});

test('iteración: línea de tiempo proporcional con fechas y marcas solo dentro del ciclo', async () => {
  const m = await import('../public/modulos/iteracion.js');
  const it = { numero: 1, fase: 'construir', semanas: 6, inicio: '2026-09-08', demo: '2026-10-16', artefactos: {}, decisiones: [], dedicacion: {} };
  const ts = m.tramos(it);
  assert.deepEqual(ts.map((t) => [t.inicio, t.fin]), [['2026-09-08', '2026-09-15'], ['2026-09-15', '2026-09-22'], ['2026-09-22', '2026-10-06'], ['2026-10-06', '2026-10-17'], ['2026-10-17', '2026-10-20']]);
  assert.equal(m.posicion({ ...it, semanas: -2 }, '2026-09-10'), null, 'semanas inválidas: sin marca, nunca NaN');
  assert.equal(m.posicion(it, '2026-09-08'), 0); assert.equal(m.posicion(it, '2026-10-20'), 100); assert.equal(m.posicion(it, '2026-11-01'), null); assert.equal(m.posicion({ ...it, inicio: '' }, '2026-09-10'), null);
  assert.deepEqual(m.tramos({ ...it, semanas: 8 }).map((t) => Math.round(t.hasta * 10) / 10), [1.3, 2.7, 5.3, 7.3, 8]);
  S.estado = { ...base(), iteracion: it }; S.yo = S.estado.yo;
  const v = m.default.vista();
  assert.match(v, /class="linea"/); assert.match(v, /class="tramo now"[^>]*data-f="construir" aria-pressed="true"/); assert.match(v, /class="marca prueba" style="left:90\.5%"/);
  assert.match(v, /22 sep–6 oct/); assert.match(v, /15–22 sep/, 'mismo mes: rango corto');
  S.estado.iteracion = { ...it, inicio: '' }; const sin = m.default.vista(); assert.match(sin, /sem 0–1/); assert.ok(!sin.includes('class="marca'), 'sin inicio no hay marcas');
});

test('actividad: filtros por persona y por tipo, con mensaje cuando no queda nada', async () => {
  const m = await import('../public/modulos/actividad.js');
  const acts = [{ fecha: '2026-09-17T10:00:00Z', quien: 'max', accion: 'crea', objeto: 'tarea', id: 't1', titulo: 'Mapa' }, { fecha: '2026-09-17T09:00:00Z', quien: 'pablo', accion: 'mueve', objeto: 'idea', id: 'o1', titulo: 'Fact', detalle: 'elegida' }];
  assert.equal(m.filtrarActividad(acts, { quien: 'max', tipo: 'todo' }).length, 1); assert.equal(m.filtrarActividad(acts, { quien: 'todos', tipo: 'idea' })[0].id, 'o1'); assert.equal(m.filtrarActividad(acts, { quien: 'max', tipo: 'idea' }).length, 0);
  S.estado = { ...base(), actividad: acts }; S.yo = S.estado.yo; S.f = leerFiltros(() => null);
  assert.match(m.default.vista(), /data-act="fact-tipo" data-v="prospecto" aria-pressed="false">Usuarios de prueba/);
  S.f.actividad = { quien: 'max', tipo: 'idea' }; assert.match(m.default.vista(), /Nada con estos filtros/);
  S.f = leerFiltros(() => null);
});

test('Ajustes: cuenta, apariencia, avisos, iteración compartida, equipo y la app', async () => {
  const m = (await import('../public/modulos/ajustes.js')).default;
  S.estado = base(); S.yo = S.estado.yo; S.tema = 'dark'; S.letra = 'grande'; S.sonido = false; S.version = 'rev-<1>';
  const h = m.vista();
  for (const t of ['Tu cuenta', 'Apariencia', 'Avisos', 'Iteración', 'El equipo', 'La app']) assert.ok(h.includes(`<h2>${t}</h2>`), t);
  assert.match(h, /data-act="tema" data-v="dark" aria-pressed="true"/); assert.match(h, /data-act="letra" data-v="grande" aria-pressed="true"/); assert.match(h, /data-act="sonido" data-v="no" aria-pressed="true"/);
  assert.match(h, /data-bind="iter:actual:semanas" value="6"/); assert.ok(h.includes('rev-&lt;1&gt;'), 'la versión se escapa'); assert.match(h, /href="\/salir" data-act="salir"/);
  for (const a of ['letra', 'sonido', 'probar-sonido', 'reset-prefs']) assert.equal(typeof m.acciones[a], 'function', a);
  S.tema = 'auto'; S.letra = 'normal'; S.version = '';
});
