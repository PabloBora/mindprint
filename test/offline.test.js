/* Escrituras sin red, en Node: fetch que falla como en el navegador sin conexión. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/estado.js';
import { bus } from '../public/ui/base.js';
import { cola, enviarMensaje, borrarMensaje, guardarTarea, aplicarColaLocal } from '../public/api.js';

const sinRed = () => { throw new TypeError('Failed to fetch'); };
const base = () => ({ version: 1, yo: { persona: 'pablo' }, personas: { pablo: { nombre: 'Pablo', rol: 'T' } }, ideas: [], tareas: [], prospectos: [], mensajes: [], iteracion: {}, actividad: [], enLinea: [] });

test('sin red: un mensaje enviado y borrado antes de salir no deja nada en la cola ni en pantalla; el resto se conserva', async () => {
  const fetchReal = globalThis.fetch; globalThis.fetch = sinRed; cola.limpiar();
  S.estado = base(); S.yo = S.estado.yo; S.ruta = { mod: 'chat', id: null, sub: null };
  const avisos = []; const off = bus.on('error', (e) => avisos.push(typeof e === 'string' ? e : e.msg));
  try {
    assert.equal(await enviarMensaje('hola'), true, 'sin red la escritura se acepta y se encola');
    assert.equal(await guardarTarea({ id: 't9', titulo: 'x', detalle: '', motivo: '', responsable: 'pablo', fase: 'general', estado: 'pendiente', vence: '', ideaId: '' }), true);
    assert.equal(cola.largo, 2); assert.equal(S.estado.mensajes.length, 1); assert.ok(S.estado.mensajes[0]._pendiente); assert.match(S.estado.mensajes[0].id, /^pendiente-mensajes\//);
    assert.match(avisos[0], /Sin conexión/);
    assert.equal(await borrarMensaje(S.estado.mensajes[0].id), true);
    assert.equal(S.estado.mensajes.length, 0, 'desaparece de pantalla');
    assert.equal(cola.largo, 1, 'el POST se retira de la cola; la tarea sigue');
    assert.equal(cola.items[0].clave, 'tareas/t9');
    S.estado = base(); S.yo = S.estado.yo; aplicarColaLocal();
    assert.equal(S.estado.tareas.length, 1); assert.ok(S.estado.tareas[0]._pendiente, 'al recargar, lo pendiente se vuelve a pintar');
  } finally { globalThis.fetch = fetchReal; off(); cola.limpiar(); }
});
