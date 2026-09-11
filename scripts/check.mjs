#!/usr/bin/env node
// Verifica sintaxis de todo el JS del repo y del script embebido en public/index.html.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const archivos = [];
for (const dir of ['src', 'scripts', 'test', 'public']) {
  const abs = path.join(raiz, dir); if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs, { recursive: true })) if (/\.(m?js)$/.test(f)) archivos.push(path.join(abs, f));
}
let fallas = 0;
for (const f of archivos) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { fallas++; console.error(`✗ ${path.relative(raiz, f)}\n${e.stderr}`); } }
const html = path.join(raiz, 'public', 'index.html');
if (fs.existsSync(html)) {
  const s = fs.readFileSync(html, 'utf8');
  for (const m of s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) { try { new Function(m[1]); } catch (e) { fallas++; console.error(`✗ public/index.html <script>: ${e.message}`); } }
}
console.log(fallas ? `check: ${fallas} archivo(s) con error` : `check: ${archivos.length} archivos JS OK`);
process.exit(fallas ? 1 : 0);
