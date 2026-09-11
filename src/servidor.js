// Tablero Mindprint — servidor HTTP. `node src/servidor.js` arranca; `crearApp` sirve a las pruebas.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerTokens, personaPorToken, crearSesion, cabeceraCookie, middlewareSesion, requiereSesion, PERSONAS } from './auth.js';
import { crearDatos } from './datos/index.js';
import { crearEstado } from './estado.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(AQUI, '..', 'public');

export async function crearApp({ secreto, tokens, datos, publicDir = PUBLIC, produccion = process.env.NODE_ENV === 'production' } = {}) {
  if (!secreto || secreto.length < 16) throw new Error('MP_SECRET debe tener al menos 16 caracteres');
  const mapaTokens = tokens instanceof Map ? tokens : leerTokens(tokens);
  if (mapaTokens.size === 0) throw new Error('MP_TOKENS no trae ninguna liga válida (persona:token, token ≥ 16 caracteres)');
  const estado = crearEstado(datos);
  await estado.cargar();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    // En producción todo va por https: la cookie de sesión jamás viaja en claro.
    // Localhost (npm run dev, pruebas) queda fuera porque no hay proxy TLS.
    if (produccion && !req.secure) return res.redirect(308, `https://${req.hostname}${req.originalUrl}`);
    if (produccion) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(middlewareSesion(secreto));

  app.get('/salud', (_req, res) => res.json({ ok: true, backend: datos.nombre, version: estado.st.version }));

  app.get('/entrar/:token', (req, res) => {
    const persona = personaPorToken(mapaTokens, req.params.token);
    if (!persona) return res.status(404).type('html').send(paginaLigaInvalida());
    res.setHeader('Set-Cookie', cabeceraCookie(crearSesion(persona, secreto), { segura: produccion || req.secure }));
    res.redirect(302, '/');
  });
  app.get('/salir', (req, res) => {
    res.setHeader('Set-Cookie', cabeceraCookie('', { segura: produccion || req.secure, maxAgeSegundos: 0 }));
    res.redirect(302, '/');
  });

  const api = express.Router();
  api.use(requiereSesion);
  api.get('/estado', (req, res) => res.json(estado.snapshot(req.persona)));
  api.get('/eventos', (req, res) => estado.conectarSSE(req, res, req.persona));
  api.put('/ideas/:id', async (req, res, next) => {
    try { const doc = await estado.guardarIdea({ ...req.body, id: req.params.id }, req.persona); res.json({ ok: true, version: estado.st.version, doc }); } catch (e) { next(e); }
  });
  api.delete('/ideas/:id', async (req, res, next) => {
    try { const ok = await estado.borrarIdea(req.params.id, req.persona); res.status(ok ? 200 : 404).json({ ok, version: estado.st.version }); } catch (e) { next(e); }
  });
  api.put('/tareas/:id', async (req, res, next) => {
    try { const doc = await estado.guardarTarea({ ...req.body, id: req.params.id }, req.persona); res.json({ ok: true, version: estado.st.version, doc }); } catch (e) { next(e); }
  });
  api.delete('/tareas/:id', async (req, res, next) => {
    try { const ok = await estado.borrarTarea(req.params.id, req.persona); res.status(ok ? 200 : 404).json({ ok, version: estado.st.version }); } catch (e) { next(e); }
  });
  api.put('/prospectos/:id', async (req, res, next) => {
    try { const doc = await estado.guardarProspecto({ ...req.body, id: req.params.id }, req.persona); res.json({ ok: true, version: estado.st.version, doc }); } catch (e) { next(e); }
  });
  api.delete('/prospectos/:id', async (req, res, next) => {
    try { const ok = await estado.borrarProspecto(req.params.id, req.persona); res.status(ok ? 200 : 404).json({ ok, version: estado.st.version }); } catch (e) { next(e); }
  });
  api.put('/iteracion', async (req, res, next) => {
    try { const doc = await estado.guardarIteracion(req.body, req.persona); res.json({ ok: true, version: estado.st.version, doc }); } catch (e) { next(e); }
  });
  api.post('/mensajes', async (req, res, next) => {
    try { const doc = await estado.guardarMensaje(req.body, req.persona); res.status(201).json({ ok: true, version: estado.st.version, doc }); } catch (e) { next(e); }
  });
  api.delete('/mensajes/:id', async (req, res, next) => {
    try { const ok = await estado.borrarMensaje(req.params.id, req.persona); res.status(ok ? 200 : 404).json({ ok, version: estado.st.version }); } catch (e) { next(e); }
  });
  api.post('/reto', (_req, res) => res.status(501).json({ error: 'no_disponible', detalle: 'Reto de Claude: fuera de alcance v1 (requiere API key).' }));
  app.use('/api', api);

  app.use(express.static(publicDir, { index: 'index.html', maxAge: '5m', etag: true }));
  app.use((req, res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'no_encontrado' }); res.status(404).type('text').send('No encontrado'); });
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    const codigo = err.code && typeof err.code === 'string' && /^[a-z_]+$/.test(err.code) ? err.code : status >= 500 ? 'error_interno' : 'peticion_invalida';
    res.status(status).json({ error: codigo, detalle: status < 500 ? err.message : undefined });
  });
  return { app, estado };
}

function paginaLigaInvalida() {
  return `<!doctype html><meta charset="utf-8"><title>Liga no válida</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto;color:#1B1F3A"><h1 style="font-size:22px">Esta liga no abre el tablero</h1><p>Puede estar incompleta o haberse rotado. Pídele a Pablo tu liga personal y ábrela completa.</p><p><a href="/">Volver</a></p></body>`;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const datos = await crearDatos(process.env);
  const { app } = await crearApp({ secreto: process.env.MP_SECRET, tokens: process.env.MP_TOKENS, datos });
  const puerto = parseInt(process.env.PORT || '8080', 10);
  app.listen(puerto, () => console.log(`Tablero Mindprint en http://localhost:${puerto} · datos: ${datos.nombre} · personas: ${Object.keys(PERSONAS).join(', ')}`));
}
