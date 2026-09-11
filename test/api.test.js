import test from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/servidor.js';
import { crearMemory } from '../src/datos/memory.js';
import { COOKIE } from '../src/auth.js';

const SECRETO = 'secreto-de-prueba-largo-01';
const TOK_PABLO = 'token-de-pablo-para-prueba-01';
const TOK_MAX = 'token-de-max-para-pruebas-001';

async function arrancar() {
  const { app, estado } = await crearApp({ secreto: SECRETO, tokens: `pablo:${TOK_PABLO},max:${TOK_MAX}`, datos: crearMemory() });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, estado, cerrar: () => new Promise((r) => server.close(r)) };
}
async function entrar(base, token) {
  const r = await fetch(`${base}/entrar/${token}`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  const sc = r.headers.get('set-cookie'); assert.ok(sc && sc.includes(COOKIE + '='));
  return sc.split(';')[0];
}
const json = (m, cookie, body) => ({ method: m, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('sin cookie no hay API; liga mala da 404; liga buena da cookie', async () => {
  const { base, cerrar } = await arrancar();
  try {
    assert.equal((await fetch(`${base}/api/estado`)).status, 401);
    assert.equal((await fetch(`${base}/entrar/liga-que-no-existe-000000`, { redirect: 'manual' })).status, 404);
    const cookie = await entrar(base, TOK_PABLO);
    const r = await fetch(`${base}/api/estado`, { headers: { cookie } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.yo.persona, 'pablo'); assert.equal(j.yo.nombre, 'Pablo');
    assert.deepEqual(j.ideas, []); assert.equal(j.iteracion.fase, 'elegir');
  } finally { await cerrar(); }
});

test('ideas: crear, mover, votar con tope, borrar; actividad y versión avanzan', async () => {
  const { base, cerrar } = await arrancar();
  try {
    const cp = await entrar(base, TOK_PABLO); const cm = await entrar(base, TOK_MAX);
    let r = await fetch(`${base}/api/ideas/i1`, json('PUT', cp, { titulo: 'Conciliar facturas', etapa: 'semilla' }));
    assert.equal(r.status, 200); let j = await r.json(); assert.equal(j.doc.actualizadoPor, 'pablo'); assert.equal(j.version, 1);
    r = await fetch(`${base}/api/ideas/i1`, json('PUT', cm, { titulo: 'Conciliar facturas', etapa: 'candidata', votos: { max: 2 } }));
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/ideas/i2`, json('PUT', cm, { titulo: 'Otra', votos: { max: 2 } }));
    assert.equal(r.status, 400); j = await r.json(); assert.equal(j.error, 'sin_votos');
    r = await fetch(`${base}/api/ideas/i2`, json('PUT', cm, { titulo: 'Otra', votos: { max: 1 } }));
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/ideas/x`, json('PUT', cp, { titulo: '' }));
    assert.equal(r.status, 400);
    const est = await (await fetch(`${base}/api/estado`, { headers: { cookie: cp } })).json();
    assert.equal(est.ideas.length, 2);
    assert.equal(est.ideas.find((i) => i.id === 'i1').etapa, 'candidata');
    assert.equal(est.actividad[0].objeto, 'idea');
    assert.ok(est.actividad.some((a) => a.accion === 'mueve' && a.detalle === 'candidata'));
    assert.ok(est.actividad.some((a) => a.accion === 'crea' && a.quien === 'pablo'));
    r = await fetch(`${base}/api/ideas/i1`, { method: 'DELETE', headers: { cookie: cp } });
    assert.equal(r.status, 200);
    assert.equal((await fetch(`${base}/api/ideas/i1`, { method: 'DELETE', headers: { cookie: cp } })).status, 404);
    assert.equal((await fetch(`${base}/api/ideas/i9`, json('PUT', cm, { titulo: 'Con 3', votos: { max: 3 } }))).status, 400);
  } finally { await cerrar(); }
});

test('tareas e iteración: guardar y validar; decisión queda en actividad', async () => {
  const { base, cerrar } = await arrancar();
  try {
    const cp = await entrar(base, TOK_PABLO);
    let r = await fetch(`${base}/api/tareas/t1`, json('PUT', cp, { titulo: 'Compartir carpeta', responsable: 'pablo', estado: 'pendiente', vence: '2026-09-15' }));
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/tareas/t1`, json('PUT', cp, { titulo: 'Compartir carpeta', responsable: 'pablo', estado: 'hecha' }));
    assert.equal(r.status, 200);
    r = await fetch(`${base}/api/iteracion`, json('PUT', cp, { numero: 1, fase: 'entender', decisiones: [{ texto: 'Seguimos con conciliación', tipo: 'seguir', quien: 'pablo' }] }));
    assert.equal(r.status, 200);
    const est = await (await fetch(`${base}/api/estado`, { headers: { cookie: cp } })).json();
    assert.equal(est.tareas[0].estado, 'hecha');
    assert.equal(est.iteracion.fase, 'entender');
    assert.equal(est.actividad[0].accion, 'decide'); assert.equal(est.actividad[0].detalle, 'seguir');
    assert.ok(est.actividad.some((a) => a.objeto === 'tarea' && a.accion === 'mueve' && a.detalle === 'hecha'));
    r = await fetch(`${base}/api/iteracion`, { method: 'PUT', headers: { cookie: cp, 'content-type': 'application/json' }, body: '{no es json' });
    assert.equal(r.status, 400);
  } finally { await cerrar(); }
});

test('eventos: SSE saluda, reporta presencia y avisa cambios', async () => {
  const { base, cerrar, estado } = await arrancar();
  try {
    const cp = await entrar(base, TOK_PABLO);
    const ctrl = new AbortController();
    const r = await fetch(`${base}/api/eventos`, { headers: { cookie: cp }, signal: ctrl.signal });
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/event-stream/);
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    const leerHasta = async (txt) => { for (let i = 0; i < 20 && !buf.includes(txt); i++) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value); } assert.ok(buf.includes(txt), `esperaba "${txt}" en:\n${buf}`); };
    await leerHasta('event: hola'); await leerHasta('event: presencia');
    assert.ok(buf.includes('"enLinea":["pablo"]'));
    assert.deepEqual(estado.enLinea(), ['pablo']);
    await fetch(`${base}/api/ideas/i1`, json('PUT', cp, { titulo: 'Nueva' }));
    await leerHasta('event: cambio');
    ctrl.abort();
    await new Promise((res) => setTimeout(res, 50));
    assert.deepEqual(estado.enLinea(), []);
  } finally { await cerrar(); }
});

test('salir borra la cookie', async () => {
  const { base, cerrar } = await arrancar();
  try {
    const r = await fetch(`${base}/salir`, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await fetch(`${base}/salud`)).status, 200);
  } finally { await cerrar(); }
});
