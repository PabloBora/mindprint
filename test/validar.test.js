import test from 'node:test';
import assert from 'node:assert/strict';
import { validarIdea, validarTarea, validarProspecto, validarIteracion, ErrorValidacion } from '../src/validar.js';

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
  assert.equal(Object.keys(it.artefactos).length, 9); assert.equal(it.artefactos.mapa.hecho, true); assert.equal(it.artefactos.demo.hecho, false);
  assert.equal(it.semanas, 6);
  assert.equal(validarIteracion({ semanas: 12 }).semanas, 8); assert.equal(validarIteracion({ semanas: '5' }).semanas, 5);
});
test('iteración: las claves viejas de artefactos se descartan (migración silenciosa)', () => {
  const it = validarIteracion({ artefactos: { candidatos: { hecho: true, liga: 'x' }, mvp: { hecho: true } } });
  assert.equal('candidatos' in it.artefactos, false); assert.equal('mvp' in it.artefactos, false);
  assert.deepEqual(Object.keys(it.artefactos), ['caso', 'prospecto', 'mapa', 'caso_negocio', 'demo', 'doc_interna', 'propuesta', 'costos', 'decision']);
});
test('prospecto: empresa obligatoria, etapa y responsable con default, fecha válida', () => {
  assert.throws(() => validarProspecto({ id: 'p1', empresa: '  ' }), (e) => e.code === 'empresa_requerida');
  const p = validarProspecto({ id: 'p1', empresa: ' Acme ', etapa: 'volando', responsable: 'nadie', fechaSiguiente: '2026-02-30', casoId: '../x' });
  assert.equal(p.empresa, 'Acme'); assert.equal(p.etapa, 'seleccion'); assert.equal(p.responsable, 'todos'); assert.equal(p.fechaSiguiente, ''); assert.equal(p.casoId, '');
  assert.equal(validarProspecto({ id: 'p1', empresa: 'Acme', etapa: 'piloto', fechaSiguiente: '2026-10-01', casoId: 'caso-1' }).etapa, 'piloto');
});
