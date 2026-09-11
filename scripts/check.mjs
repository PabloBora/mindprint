#!/usr/bin/env node
// Verifica sintaxis de todo el JS del repo y de los <script> inline de public/index.html
// (los inline no deberían existir con el CSP `script-src 'self'`, pero si aparecen, se revisan).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivos = [];
for (const dir of ['src', 'scripts', 'test', 'public']) {
  const abs = path.join(raiz, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs, { recursive: true })) if (/\.m?js$/.test(f)) archivos.push(path.join(abs, f));
}
let fallas = 0;
function revisar(ruta, etiqueta, modulo) {
  const args = modulo ? ['--input-type=module', '--check', ruta] : ['--check', ruta];
  try { execFileSync(process.execPath, args, { stdio: 'pipe' }); }
  catch (e) { fallas++; console.error(`✗ ${etiqueta}\n${e.stderr}`); }
}
for (const f of archivos) revisar(f, path.relative(raiz, f), false);

const html = path.join(raiz, 'public', 'index.html');
let inline = 0;
if (fs.existsSync(html)) {
  const s = fs.readFileSync(html, 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-check-'));
  for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    const esModulo = /type=["']module["']/.test(m[1]);
    const ruta = path.join(tmp, `inline-${++inline}.${esModulo ? 'mjs' : 'js'}`);
    fs.writeFileSync(ruta, m[2]);
    revisar(ruta, `public/index.html <script> #${inline}`, esModulo);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (inline) console.warn(`aviso: ${inline} <script> inline en public/index.html; el CSP del servidor solo permite script-src 'self'`);
}
console.log(fallas ? `check: ${fallas} archivo(s) con error` : `check: ${archivos.length} archivos JS OK`);
process.exit(fallas ? 1 : 0);
