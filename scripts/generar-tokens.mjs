#!/usr/bin/env node
// Genera ligas personales nuevas. Uso: npm run tokens [-- https://tu-url.run.app]
import crypto from 'node:crypto';
import { PERSONAS } from '../src/auth.js';
const base = (process.argv[2] || process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const pares = Object.keys(PERSONAS).map((p) => [p, crypto.randomBytes(24).toString('base64url')]);
console.log('MP_TOKENS=' + pares.map(([p, t]) => `${p}:${t}`).join(','));
console.log('');
for (const [p, t] of pares) console.log(`${PERSONAS[p].nombre.padEnd(7)} ${base}/entrar/${t}`);
console.log('\nGuarda MP_TOKENS en Secret Manager y manda a cada quien SOLO su liga. Rotar = volver a correr esto.');
