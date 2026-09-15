import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/estado.js';
import { buscarGlobal, puntaje, normalizar, GRUPOS } from '../public/buscar.js';

const fixture = () => ({
  version: 1, yo: { persona: 'pablo' }, personas: { pablo: { nombre: 'Pablo', rol: 'T' }, max: { nombre: 'Max', rol: 'P' }, daniel: { nombre: 'Daniel', rol: 'M' } },
  ideas: [{ id: 'o1', titulo: 'Agentes de facturación', dolor: 'Capturan CFDI a mano', etapa: 'elegida' }, { id: 'o2', titulo: 'Cobranza', dolor: '', etapa: 'semilla', notas: 'facturas vencidas' }],
  tareas: [{ id: 't1', titulo: 'Mapa del proceso de facturación', detalle: '', motivo: '', responsable: 'max', fase: 'entender', estado: 'en_curso' }, { id: 't2', titulo: 'Otra', detalle: 'ver facturación con Ruiz', motivo: '', responsable: 'todos', fase: 'general', estado: 'pendiente' }, { id: 't3', titulo: 'Facturación: demo', detalle: '', motivo: '', responsable: 'pablo', fase: 'construir', estado: 'pendiente' }],
  prospectos: [{ id: 'u1', empresa: 'Maquinados del Bajío', contacto: 'Ing. Ruiz', relacion: 'Cliente', area: 'Ventas', etapa: 'probando', siguientePaso: 'Llamar', notas: '' }],
  mensajes: [{ id: 'm1', fecha: '2026-09-11T11:00:00Z', quien: 'max', texto: 'Ya hablé con Ruiz de la facturación', ref: null }, { id: 'm2', fecha: '2026-09-11T11:05:00Z', quien: 'daniel', texto: 'Ruiz dice que sí', ref: { tipo: 'prospecto', id: 'u1', titulo: 'Maquinados' } }],
  iteracion: { numero: 1, fase: 'entender' }, actividad: [], enLinea: [],
});

test('normalizar y puntaje: sin acentos ni mayúsculas; prefijo > contiene > campo secundario', () => {
  assert.equal(normalizar('Facturación ÁÉ'), 'facturacion ae');
  assert.equal(puntaje('factura', ['Facturación: demo', '']), 3);
  assert.equal(puntaje('factura', ['Mapa de facturación', '']), 2);
  assert.equal(puntaje('factura', ['Otra', 'ver facturación']), 1);
  assert.equal(puntaje('zzz', ['Otra', 'ver facturación']), 0);
});

test('buscarGlobal agrupa los cuatro tipos, ordena por relevancia, limita y resuelve comentarios a su tarjeta', () => {
  S.estado = fixture(); S.yo = S.estado.yo;
  assert.equal(buscarGlobal(''), null); assert.equal(buscarGlobal('f'), null, 'menos de 2 letras no busca');
  const r = buscarGlobal('FACTURA');
  assert.deepEqual(Object.keys(r), GRUPOS.map((g) => g.k));
  assert.equal(r.tareas.total, 3); assert.deepEqual(r.tareas.items.map((t) => t.id), ['t3', 't1', 't2'], 'prefijo, luego contiene, luego detalle');
  assert.equal(r.tareas.items[0].mod, 'tareas'); assert.match(r.tareas.items[0].sub, /Pendiente · Pablo · Construir/);
  assert.equal(r.oportunidades.total, 2); assert.equal(r.oportunidades.items[0].id, 'o1'); assert.match(r.oportunidades.items[0].sub, /^Elegida · Capturan/);
  assert.equal(r.usuarios.total, 0);
  assert.equal(r.mensajes.total, 1); assert.equal(r.mensajes.items[0].mod, 'chat'); assert.equal(r.mensajes.items[0].id, 'm1');
  const ruiz = buscarGlobal('ruiz');
  assert.equal(ruiz.usuarios.total, 1); assert.equal(ruiz.usuarios.items[0].titulo, 'Maquinados del Bajío'); assert.match(ruiz.usuarios.items[0].sub, /Probando · Ing\. Ruiz · Cliente/);
  const coment = ruiz.mensajes.items.find((m) => m.titulo.startsWith('Ruiz dice'));
  assert.equal(coment.mod, 'usuarios'); assert.equal(coment.id, 'u1', 'un comentario abre la tarjeta comentada'); assert.match(coment.sub, /Daniel · .* · en usuario de prueba «Maquinados del Bajío»/);
  const pocos = buscarGlobal('factura', { max: 1 }); assert.equal(pocos.tareas.total, 3); assert.equal(pocos.tareas.items.length, 1);
  const largo = buscarGlobal('dice'); assert.ok(largo.mensajes.items[0].titulo.length <= 91);
});
