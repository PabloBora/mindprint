import test from 'node:test';
import assert from 'node:assert/strict';
import { leerTokens, personaPorToken, firmar, verificar, crearSesion, leerCookies, cabeceraCookie, COOKIE } from '../src/auth.js';

const SECRETO = 'secreto-de-prueba-largo-01';

test('leerTokens ignora entradas cortas, malformadas o de personas desconocidas', () => {
  const m = leerTokens('pablo:abcdefghijklmnopqrstuv,max:corto,otro:abcdefghijklmnopqrstuv,daniel');
  assert.equal(m.size, 1);
  assert.equal(m.get('abcdefghijklmnopqrstuv'), 'pablo');
});

test('personaPorToken encuentra por igualdad exacta', () => {
  const m = leerTokens('pablo:abcdefghijklmnopqrstuv,max:zyxwvutsrqponmlkjihgfe');
  assert.equal(personaPorToken(m, 'zyxwvutsrqponmlkjihgfe'), 'max');
  assert.equal(personaPorToken(m, 'zyxwvutsrqponmlkjihgfX'), null);
  assert.equal(personaPorToken(m, ''), null);
  assert.equal(personaPorToken(m, undefined), null);
});

test('la cookie firmada se verifica; alterada o con otro secreto no', () => {
  const c = crearSesion('daniel', SECRETO);
  assert.equal(verificar(c, SECRETO), 'daniel');
  assert.equal(verificar(c, 'otro-secreto-igual-de-largo'), null);
  assert.equal(verificar(c.slice(0, -2) + 'zz', SECRETO), null);
  const [cuerpo] = c.split('.');
  assert.equal(verificar(cuerpo + '.', SECRETO), null);
  assert.equal(verificar('', SECRETO), null);
  assert.equal(verificar(null, SECRETO), null);
});

test('una sesión expirada no vale', () => {
  const c = firmar({ p: 'max', exp: Date.now() - 1000 }, SECRETO);
  assert.equal(verificar(c, SECRETO), null);
});

test('una persona inventada en el payload no vale aunque la firma sea válida', () => {
  const c = firmar({ p: 'intruso', exp: Date.now() + 100000 }, SECRETO);
  assert.equal(verificar(c, SECRETO), null);
});

test('cookies: parseo y cabecera', () => {
  assert.deepEqual(leerCookies('a=1; ' + COOKIE + '=x%2Ey; b=2'), { a: '1', [COOKIE]: 'x.y', b: '2' });
  const h = cabeceraCookie('v.w', { segura: true });
  assert.match(h, /HttpOnly/); assert.match(h, /Secure/); assert.match(h, /SameSite=Lax/); assert.match(h, /Max-Age=7776000/);
  assert.doesNotMatch(cabeceraCookie('v.w'), /Secure/);
});
