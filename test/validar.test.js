import test from 'node:test';
import assert from 'node:assert/strict';
import { validarIdea, validarTarea, validarIteracion, ErrorValidacion } from '../src/validar.js';

test('idea: limpia, acota y rellena por default', () => {
  const d = validarIdea({ id: 'abc-1', titulo: '  Conciliar facturas  ', etapa: 'nada', votos: { pablo: 9, intruso: 2 }, criterios: { dolor: 5 }, reacciones: { max: 'late', daniel: 'x' }, autor: 'max' });
  assert.equal(d.titulo, 'Conciliar facturas');
  assert.equal(d.etapa, 'semilla');
  assert.deepEqual(d.votos, { pablo: 3 });
  assert.deepEqual(d.criterios, { acceso: 0, dolor: 2, agentizable: 0 });
  assert.deepEqual(d.reacciones, { max: 'late', daniel: '' });
  assert.equal(d.autor, 'max');
});
test('idea: sin título o con id raro falla con 400', () => {
  assert.throws(() => validarIdea({ id: 'a', titulo: '   ' }), (e) => e instanceof ErrorValidacion && e.status === 400 && e.code === 'titulo_requerido');
  assert.throws(() => validarIdea({ id: '../x', titulo: 'ok' }), (e) => e.code === 'id_invalido');
});
test('tarea: enumerados y fecha', () => {
  const t = validarTarea({ id: 't1', titulo: 'Probar', responsable: 'nadie', estado: 'volando', vence: '2026-13-99', fase: 'elegir' });
  assert.equal(t.responsable, 'todos'); assert.equal(t.estado, 'pendiente'); assert.equal(t.vence, ''); assert.equal(t.fase, 'elegir');
  assert.equal(validarTarea({ id: 't1', titulo: 'x', vence: '2026-09-30' }).vence, '2026-09-30');
});
test('iteración: decisiones vacías se descartan, artefactos completos', () => {
  const it = validarIteracion({ fase: 'construir', decisiones: [{ texto: '  ' }, { texto: 'Seguimos', tipo: 'seguir', quien: 'pablo' }], artefactos: { mapa: { hecho: true, liga: 'https://x' } } });
  assert.equal(it.fase, 'construir');
  assert.equal(it.decisiones.length, 1); assert.equal(it.decisiones[0].tipo, 'seguir');
  assert.equal(Object.keys(it.artefactos).length, 6); assert.equal(it.artefactos.mapa.hecho, true); assert.equal(it.artefactos.mvp.hecho, false);
});
