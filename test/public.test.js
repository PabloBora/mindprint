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
const leer = (...p) => fs.readFileSync(path.join(PUBLIC, ...p), 'utf8');
const html = leer('index.html');
const todosJs = () => { const out = []; for (const d of ['', 'ui', 'modulos']) for (const f of fs.readdirSync(path.join(PUBLIC, d))) if (f.endsWith('.js')) out.push(path.join(PUBLIC, d, f)); return out; };

test('index.html: shell sin scripts inline, módulo ES, manifest, hojas de estilo y viewport', () => {
  const inline = [...html.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]));
  assert.equal(inline.length, 0, 'el CSP del servidor no permite scripts inline');
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  for (const hoja of ['tokens', 'base', 'shell', 'componentes', 'modulos']) assert.match(html, new RegExp(`href="/estilos/${hoja}\\.css"`));
  for (const id of ['lateral', 'cabecera', 'vista', 'inferior', 'panel', 'confirmar', 'toast']) assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  assert.match(html, /<title>Tablero Mindprint<\/title>/); assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /onclick=|onload=/i);
});

test('todo el JS del cliente parsea y solo habla con el mismo origen', () => {
  const archivos = todosJs(); assert.ok(archivos.length >= 12, `hay ${archivos.length} archivos`);
  for (const f of archivos) execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  const js = archivos.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(js, /https?:\/\/(?!docs\.google\.com|drive\.google\.com)/, 'solo ligas al Doc y a Drive; el API es relativo');
  for (const ruta of ['/api/estado', '/api/eventos', '/api/ideas/', '/api/tareas/', '/api/prospectos/', '/api/iteracion', '/api/mensajes', '/entrar/', '/salir']) assert.ok(js.includes(ruta), `usa ${ruta}`);
});

test('sw.js: todo lo que precachea existe en public/ y todo módulo del cliente está en la lista', () => {
  const sw = leer('sw.js');
  const shell = [...sw.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]).filter((u) => u !== '/' && !u.startsWith('/api/') && !u.startsWith('/entrar') && u !== '/salir' && u !== '/sw.js' && u !== '/version.json');
  assert.ok(shell.length >= 20);
  for (const u of shell) assert.ok(fs.existsSync(path.join(PUBLIC, u)), `precachea ${u} y existe`);
  for (const f of todosJs()) { const rel = '/' + path.relative(PUBLIC, f).split(path.sep).join('/'); if (rel !== '/sw.js') assert.ok(shell.includes(rel), `${rel} está en el shell del service worker`); }
  for (const hoja of ['tokens', 'base', 'shell', 'componentes', 'modulos']) assert.ok(shell.includes(`/estilos/${hoja}.css`));
  assert.match(sw, /const VERSION = '__VERSION__'/); assert.match(sw, /cache: 'reload'/, 'el shell se baja saltando la caché HTTP'); assert.match(sw, /Promise\.race\(\[red, tarde\]\)/, 'el estado no espera de más a una red que no contesta');
  assert.match(html, /class="sk"/, 'index.html trae el esqueleto de carga antes de que corra el JS');
});

test('manifest válido con iconos y arranque en Hoy', () => {
  const m = JSON.parse(leer('manifest.webmanifest'));
  assert.equal(m.name, 'Tablero Mindprint'); assert.equal(m.start_url, '/#/hoy'); assert.equal(m.display, 'standalone');
  assert.ok(m.icons.length >= 2);
  for (const ic of m.icons) assert.ok(fs.existsSync(path.join(PUBLIC, ic.src)), `existe ${ic.src}`);
});

test('tokens.css: paleta completa en :root y los dos bloques de tema oscuro', () => {
  const css = leer('estilos', 'tokens.css');
  assert.match(css, /:root\{[^}]*--paper:#F1F2EE/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]\{/);
  for (const tok of ['--paper', '--surface', '--ink', '--accent', '--marker', '--marker-desde', '--p-pablo', '--p-max', '--p-daniel']) assert.equal((css.match(new RegExp(`${tok}:`, 'g')) || []).length, 3, `${tok} en los tres bloques`);
  const otras = ['base', 'shell', 'componentes', 'modulos'].map((h) => leer('estilos', `${h}.css`)).join('\n');
  assert.doesNotMatch(otras, /#[0-9A-Fa-f]{6}\b(?![^{]*\})/, 'las demás hojas no definen colores fuera de tokens');
});

test('el servidor sirve la interfaz con CSP, tipos correctos, manifest y ETag en el estado', async () => {
  const { app } = await crearApp({ secreto: 'secreto-de-prueba-largo-01', tokens: 'pablo:token-de-pablo-para-prueba-01', datos: crearMemory() });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/); assert.match(r.headers.get('content-security-policy'), /script-src 'self'/); assert.equal(r.headers.get('cache-control'), 'no-cache');
    assert.ok((await r.text()).includes('<title>Tablero Mindprint</title>'));
    const a = await fetch(`${base}/app.js`); assert.equal(a.status, 200); assert.match(a.headers.get('content-type'), /javascript/);
    const m = await fetch(`${base}/manifest.webmanifest`); assert.equal(m.status, 200); assert.match(m.headers.get('content-type'), /manifest\+json/);
    const c = await fetch(`${base}/estilos/tokens.css`); assert.equal(c.status, 200); assert.match(c.headers.get('content-type'), /text\/css/);
    const e = await fetch(`${base}/entrar/token-de-pablo-para-prueba-01`, { redirect: 'manual' }); const cookie = e.headers.get('set-cookie').split(';')[0];
    const s1 = await fetch(`${base}/api/estado`, { headers: { cookie } }); const etag = s1.headers.get('etag'); assert.match(etag, /^W\/"v\d+"$/); assert.equal(s1.headers.get('cache-control'), 'no-cache');
    const s2 = await fetch(`${base}/api/estado`, { headers: { cookie, 'if-none-match': etag } }); assert.equal(s2.status, 304);
    await fetch(`${base}/api/tareas/t1`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ titulo: 'x' }) });
    const s3 = await fetch(`${base}/api/estado`, { headers: { cookie, 'if-none-match': etag } }); assert.equal(s3.status, 200, 'tras un cambio la versión sube y el ETag ya no coincide');
    const sw = await fetch(`${base}/sw.js`); assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/); assert.equal(sw.headers.get('service-worker-allowed'), '/'); assert.equal(sw.headers.get('cache-control'), 'no-cache');
    const swTxt = await sw.text(); assert.ok(!swTxt.includes('__VERSION__'), 'la versión se inyecta'); assert.match(swTxt, /const VERSION = '[^']+'/);
    const v = await (await fetch(`${base}/version.json`)).json(); assert.ok(v.version && swTxt.includes(v.version), 'sw.js y version.json coinciden');
    assert.equal((await fetch(`${base}/no-existe`)).status, 404);
  } finally { await new Promise((r) => server.close(r)); }
});
