import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../src/servidor.js';
import { crearMemory } from '../src/datos/memory.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(PUBLIC, 'estilos.css'), 'utf8');
const js = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

test('index.html: sin scripts inline, referencia app.js y estilos.css, título y viewport', () => {
  const inline = [...html.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]));
  assert.equal(inline.length, 0, 'el CSP del servidor no permite scripts inline');
  assert.match(html, /<script src="\/app\.js" defer><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/estilos\.css">/);
  assert.match(html, /<title>Tablero Mindprint<\/title>/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /onclick=|onload=/i);
});

test('app.js parsea con node --check y solo habla con el mismo origen', () => {
  execFileSync(process.execPath, ['--check', path.join(PUBLIC, 'app.js')], { stdio: 'pipe' });
  assert.doesNotMatch(js, /https?:\/\/(?!docs\.google\.com|drive\.google\.com)/, 'solo ligas al Doc y a Drive; el API es relativo');
  for (const ruta of ['/api/estado', '/api/eventos', '/api/ideas/', '/api/tareas/', '/api/iteracion', '/entrar/', '/salir']) assert.ok(js.includes(ruta), `usa ${ruta}`);
});

test('estilos.css: paleta completa en :root y los dos bloques de tema oscuro', () => {
  assert.match(css, /:root\{[^}]*--paper:#F1F2EE/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]\{/);
  for (const tok of ['--paper', '--surface', '--ink', '--accent', '--marker', '--p-pablo', '--p-max', '--p-daniel']) {
    assert.equal((css.match(new RegExp(`${tok}:`, 'g')) || []).length, 3, `${tok} definido en los tres bloques`);
  }
});

test('el servidor sirve la interfaz con CSP y tipos correctos', async () => {
  const { app } = await crearApp({ secreto: 'secreto-de-prueba-largo-01', tokens: 'pablo:token-de-pablo-para-prueba-01', datos: crearMemory() });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.ok((await r.text()).includes('<title>Tablero Mindprint</title>'));
    const a = await fetch(`${base}/app.js`); assert.equal(a.status, 200); assert.match(a.headers.get('content-type'), /javascript/);
    const c = await fetch(`${base}/estilos.css`); assert.equal(c.status, 200); assert.match(c.headers.get('content-type'), /text\/css/);
    assert.equal((await fetch(`${base}/no-existe`)).status, 404);
  } finally { await new Promise((r) => server.close(r)); }
});
