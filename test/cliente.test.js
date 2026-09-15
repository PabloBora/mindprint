/* El cliente se prueba en Node: rutas puras, forma de los módulos y que cada vista/panel renderice HTML sin explotar. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsear, rutaDe } from '../public/ruta.js';
import { S } from '../public/estado.js';

test('rutas por hash: parsear y armar son inversas y toleran basura', () => {
  assert.deepEqual(parsear(''), { mod: 'hoy', id: null, sub: null });
  assert.deepEqual(parsear('#/'), { mod: 'hoy', id: null, sub: null });
  assert.deepEqual(parsear('#/tareas'), { mod: 'tareas', id: null, sub: null });
  assert.deepEqual(parsear('#/tareas/abc-1/'), { mod: 'tareas', id: 'abc-1', sub: null });
  assert.deepEqual(parsear('#/usuarios/u%201/x'), { mod: 'usuarios', id: 'u 1', sub: 'x' });
  assert.equal(rutaDe('tareas'), '#/tareas'); assert.equal(rutaDe('tareas', 'a b'), '#/tareas/a%20b'); assert.equal(rutaDe('x', null, 'y'), '#/x/y');
  assert.deepEqual(parsear(rutaDe('oportunidades', 'id-9')), { mod: 'oportunidades', id: 'id-9', sub: null });
});

const MODS = ['hoy', 'tareas', 'usuarios', 'oportunidades', 'chat', 'iteracion', 'actividad'];
const fixture = () => ({
  version: 1, yo: { persona: 'pablo', nombre: 'Pablo', rol: 'Tecnología' },
  personas: { pablo: { nombre: 'Pablo', rol: 'Tecnología' }, max: { nombre: 'Max', rol: 'Procesos' }, daniel: { nombre: 'Daniel', rol: 'Mercado' } },
  ideas: [{ id: 'o1', titulo: 'Agentes de facturación <b>', dolor: 'd', quien: 'q', agente: 'a', validacion: 'v', notas: '', autor: 'pablo', etapa: 'elegida', votos: { pablo: 2, max: 1 }, criterios: { comun: 2, dolor: 2, estandar: 1, construible: 2 }, reacciones: { max: 'late' }, creado: '2026-09-11T10:00:00Z', actualizado: '2026-09-11T10:00:00Z', actualizadoPor: 'pablo' }],
  tareas: [{ id: 't1', titulo: 'Mapa del proceso', detalle: '', motivo: '', responsable: 'max', fase: 'entender', estado: 'en_curso', vence: '2020-01-01', ideaId: 'o1', creado: '2026-09-11T10:00:00Z', actualizado: '2026-09-11T10:00:00Z', actualizadoPor: 'max' }, { id: 't2', titulo: 'Bloqueada', detalle: 'x', motivo: 'sin acceso', responsable: 'todos', fase: 'general', estado: 'bloqueada', vence: '', ideaId: '', creado: '2026-09-11T10:00:00Z', actualizado: '2026-09-11T10:00:00Z', actualizadoPor: 'pablo' }],
  prospectos: [{ id: 'u1', empresa: 'Maquinados "del" Bajío', contacto: 'Ing. Ruiz', area: 'Ventas', relacion: 'Cliente', casoId: 'o1', razon: '', dolor: '', baseline: '', siguientePaso: 'Llamar', fechaSiguiente: '2020-01-01', responsable: 'daniel', notas: '', senales: { prueba: true, repite: false, pide: false, recomienda: false, pagaria: false }, etapa: 'probando', creado: '2026-09-11T10:00:00Z', actualizado: '2026-09-11T10:00:00Z', actualizadoPor: 'daniel' }],
  mensajes: [{ id: 'm1', fecha: '2026-09-11T11:00:00Z', quien: 'max', texto: 'Hola @pablo mira https://example.com/x', ref: null }, { id: 'm2', fecha: '2026-09-11T11:05:00Z', quien: 'daniel', texto: 'comentario', ref: { tipo: 'prospecto', id: 'u1', titulo: 'Maquinados' } }],
  iteracion: { numero: 1, fase: 'entender', semanas: 6, inicio: '2026-09-08', demo: '2026-10-16', sincronia: 'martes', canal: 'WhatsApp', dedicacion: { pablo: '12', max: '8', daniel: '10' }, artefactos: { oportunidad: { hecho: true, liga: 'https://x' }, proceso_tipo: { hecho: false, liga: 'javascript:alert(1)' } }, decisiones: [{ fecha: '2026-09-11T12:00:00Z', quien: 'pablo', tipo: 'seguir', texto: 'Facturación' }] },
  actividad: [{ fecha: '2026-09-11T12:00:00Z', quien: 'pablo', accion: 'mueve', objeto: 'prospecto', id: 'u1', titulo: 'Maquinados', detalle: 'probando' }, { fecha: '2026-09-11T12:01:00Z', quien: 'max', accion: 'decide', objeto: 'iteracion', id: 'actual', titulo: 'Facturación', detalle: 'seguir' }],
  enLinea: ['pablo', 'max'],
});

test('cada módulo tiene la forma del contrato y su vista renderiza HTML con datos reales', async () => {
  S.estado = fixture(); S.yo = S.estado.yo; S.enLinea = S.estado.enLinea; S.ruta = { mod: 'hoy', id: null, sub: null }; S.q = '';
  for (const id of MODS) {
    const mod = (await import(`../public/modulos/${id}.js`)).default;
    assert.equal(mod.id, id); assert.ok(mod.titulo && mod.icono && typeof mod.vista === 'function', `${id}: id, titulo, icono, vista`);
    const html = mod.vista();
    assert.equal(typeof html, 'string'); assert.ok(html.length > 100, `${id} renderiza`);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/, `${id}: sin undefined/NaN`);
    assert.doesNotMatch(html, /Agentes de facturación <b>/, `${id}: escapa HTML de usuario`);
    if (mod.badge) assert.equal(typeof mod.badge(), 'string');
  }
});

test('paneles: edición y alta renderizan; un id inexistente devuelve null; las ligas inseguras no se pintan', async () => {
  S.estado = fixture(); S.yo = S.estado.yo;
  for (const [id, doc] of [['tareas', 't1'], ['usuarios', 'u1'], ['oportunidades', 'o1']]) {
    const mod = (await import(`../public/modulos/${id}.js`)).default;
    const p = mod.panel(doc); assert.ok(p && p.titulo && p.html.includes('data-bind="'), `${id}: panel de edición`);
    assert.ok(p.html.includes('data-submit="add-msg"'), `${id}: comentarios`);
    const n = mod.panel('nuevo'); assert.ok(n && n.html.includes('data-submit="add-'), `${id}: panel de alta`);
    assert.equal(mod.panel('no-existe'), null);
  }
  const iter = (await import('../public/modulos/iteracion.js')).default.vista();
  assert.ok(iter.includes('href="https://x"')); assert.ok(!iter.includes('href="javascript:'), 'una liga javascript: nunca se vuelve enlace');
  const chat = (await import('../public/modulos/chat.js')).default.vista();
  assert.ok(chat.includes('class="mention me"'), 'la mención a mí se resalta'); assert.ok(chat.includes('href="https://example.com/x"'));
});
