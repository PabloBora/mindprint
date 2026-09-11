#!/usr/bin/env node
// Genera un MP_SECRET nuevo y ligas personales nuevas.
// Uso: npm run tokens -- https://tu-url.run.app
//
// ROTACIÓN: las sesiones (cookies de 90 días) se firman con MP_SECRET, no con los tokens.
// Cambiar solo MP_TOKENS deja vivas las sesiones ya abiertas; para expulsar a alguien de
// verdad hay que rotar TAMBIÉN MP_SECRET (esto imprime ambos) y redeployar.
import crypto from 'node:crypto';
import { PERSONAS } from '../src/auth.js';

const base = (process.argv[2] || process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const secreto = crypto.randomBytes(32).toString('base64url');
const pares = Object.keys(PERSONAS).map((p) => [p, crypto.randomBytes(24).toString('base64url')]);

console.log(`MP_SECRET=${secreto}`);
console.log(`MP_TOKENS=${pares.map(([p, t]) => `${p}:${t}`).join(',')}`);
console.log('');
for (const [p, t] of pares) console.log(`${PERSONAS[p].nombre.padEnd(7)} ${base}/entrar/${t}`);
console.log('\nGuarda AMBOS valores en Secret Manager y manda a cada quien SOLO su liga.');
console.log('Rotar = correr esto de nuevo, actualizar los dos secretos y redeployar: sin rotar MP_SECRET, las sesiones viejas siguen vivas hasta 90 días.');
