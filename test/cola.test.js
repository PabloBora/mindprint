import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCola, esErrorDeRed } from '../public/cola.js';

const storageFalso = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('la cola dedupe por clave, persiste y vacía en orden hasta el primer fallo de red', async () => {
  const st = storageFalso(); const c = crearCola({ storage: st, clave: 'q' });
  c.agregar({ clave: 'tareas/t1', metodo: 'PUT', ruta: '/api/tareas/t1', cuerpo: { titulo: 'a' } });
  c.agregar({ clave: 'tareas/t2', metodo: 'PUT', ruta: '/api/tareas/t2', cuerpo: { titulo: 'b' } });
  c.agregar({ clave: 'tareas/t1', metodo: 'PUT', ruta: '/api/tareas/t1', cuerpo: { titulo: 'a2' } });
  assert.equal(c.largo, 2); assert.deepEqual(c.items.map((o) => o.cuerpo.titulo), ['b', 'a2'], 'la última gana y pasa al final');
  assert.equal(JSON.parse(st.getItem('q')).length, 2, 'persistida');
  const enviados = [];
  const ok1 = await c.vaciar(async (op) => { enviados.push(op.clave); return enviados.length < 2; });
  assert.equal(ok1, false); assert.equal(c.largo, 1, 'se detiene en el fallo y conserva lo que falta'); assert.equal(c.items[0].clave, 'tareas/t1');
  const ok2 = await c.vaciar(async () => true); assert.equal(ok2, true); assert.equal(c.largo, 0); assert.equal(JSON.parse(st.getItem('q')).length, 0);
  const c2 = crearCola({ storage: st, clave: 'q' }); assert.equal(c2.largo, 0, 'una instancia nueva lee lo persistido');
  st.setItem('q', 'basura'); assert.equal(crearCola({ storage: st, clave: 'q' }).largo, 0, 'storage corrupto no truena');
  assert.equal(crearCola({ storage: null }).largo, 0);
});

test('quitar retira una operación por clave y vaciar propaga excepciones sin tocar la cola', async () => {
  const c = crearCola({ storage: null });
  c.agregar({ clave: 'mensajes/a', metodo: 'POST', ruta: '/api/mensajes', cuerpo: { texto: 'a' } });
  c.agregar({ clave: 'mensajes/b', metodo: 'POST', ruta: '/api/mensajes', cuerpo: { texto: 'b' } });
  assert.equal(c.tiene('mensajes/a'), true); assert.equal(c.quitar('mensajes/a'), true); assert.equal(c.quitar('mensajes/a'), false); assert.equal(c.largo, 1);
  await assert.rejects(c.vaciar(async () => { const e = new Error('sin_sesion'); e.code = 'sin_sesion'; throw e; }), { code: 'sin_sesion' });
  assert.equal(c.largo, 1, 'una excepción no descarta ni avanza la cola');
});

test('esErrorDeRed distingue fallos de fetch de respuestas del servidor', () => {
  assert.equal(esErrorDeRed(Object.assign(new Error('Sin conexión'), { code: 'red' })), true);
  assert.equal(esErrorDeRed(new TypeError('Failed to fetch')), true);
  assert.equal(esErrorDeRed(Object.assign(new Error('x'), { code: 'sin_votos', status: 409 })), false);
  assert.equal(esErrorDeRed(null), false);
});
