import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearEstado } from '../src/estado.js';
import { crearMemory } from '../src/datos/memory.js';
import { MENSAJES_MAX } from '../src/validar.js';

const lote = (n, desde = 0) => Array.from({ length: n }, (_, i) => ({ id: `m${String(desde + i).padStart(4, '0')}`, fecha: new Date(Date.UTC(2026, 0, 1, 0, 0, desde + i)).toISOString(), quien: 'pablo', texto: `msg ${desde + i}`, ref: null }));

test('el estado carga a lo más MENSAJES_MAX mensajes y descarta los más viejos', async () => {
  const muchos = lote(MENSAJES_MAX + 5);
  const datos = { nombre: 'fake', async cargarTodo() { return { ideas: [], tareas: [], mensajes: muchos.slice().reverse(), iteracion: null, actividad: [] }; }, async guardar() {}, async borrar() {}, async guardarIteracion() {}, async guardarActividad() {} };
  const estado = crearEstado(datos);
  await estado.cargar();
  assert.equal(estado.st.mensajes.length, MENSAJES_MAX);
  assert.equal(estado.st.mensajes[0].id, 'm0005', 'se caen los 5 más viejos');
  assert.equal(estado.st.mensajes[MENSAJES_MAX - 1].id, `m${String(MENSAJES_MAX + 4).padStart(4, '0')}`);
});

test('al escribir con el tope lleno, el mensaje nuevo entra y el más viejo sale de la caché', async () => {
  const guardados = [];
  const datos = { nombre: 'fake', async cargarTodo() { return { ideas: [], tareas: [], mensajes: lote(MENSAJES_MAX), iteracion: null, actividad: [] }; }, async guardar(col, id, doc) { guardados.push([col, id, doc]); }, async borrar() {}, async guardarIteracion() {}, async guardarActividad() {} };
  const estado = crearEstado(datos);
  await estado.cargar();
  const doc = await estado.guardarMensaje({ texto: 'el 501' }, 'max');
  assert.equal(estado.st.mensajes.length, MENSAJES_MAX);
  assert.equal(estado.st.mensajes[0].id, 'm0001', 'salió m0000');
  assert.equal(estado.st.mensajes[MENSAJES_MAX - 1].id, doc.id);
  assert.deepEqual(guardados.map((g) => g[0]), ['mensajes'], 'el mensaje sí se persiste aunque salga de la caché el más viejo');
});

test('backend memory: un DATA_FILE viejo sin clave mensajes carga bien y persiste; y respeta el tope al cargar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-mensajes-'));
  const archivo = path.join(dir, 'datos.json');
  try {
    fs.writeFileSync(archivo, JSON.stringify({ ideas: {}, tareas: {}, iteracion: null, actividad: [] }));
    let datos = crearMemory({ archivo });
    assert.deepEqual((await datos.cargarTodo()).mensajes, []);
    await datos.guardar('mensajes', 'a1', { id: 'a1', fecha: '2026-01-01T00:00:00.000Z', quien: 'pablo', texto: 'hola', ref: null });
    assert.equal(JSON.parse(fs.readFileSync(archivo, 'utf8')).mensajes.a1.texto, 'hola');
    const muchos = Object.fromEntries(lote(MENSAJES_MAX + 3).map((m) => [m.id, m]));
    fs.writeFileSync(archivo, JSON.stringify({ ideas: {}, tareas: {}, mensajes: muchos, iteracion: null, actividad: [] }));
    datos = crearMemory({ archivo });
    const cargados = (await datos.cargarTodo()).mensajes;
    assert.equal(cargados.length, MENSAJES_MAX);
    assert.equal(cargados[0].id, 'm0003');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
