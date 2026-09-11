// Entrada sin contraseña: liga personal → cookie firmada (HMAC-SHA256).
import crypto from 'node:crypto';

export const PERSONAS = {
  pablo:  { nombre: 'Pablo',  rol: 'Tecnología y desarrollo' },
  max:    { nombre: 'Max',    rol: 'Procesos' },
  daniel: { nombre: 'Daniel', rol: 'Cliente y negocio · apoyo en desarrollo' },
};
export const COOKIE = 'mp_sesion';
const TOKEN_MIN = 16;

/** "pablo:abc…,max:def…" → Map(token → persona). Ignora entradas malformadas. */
export function leerTokens(cadena) {
  const mapa = new Map();
  for (const par of String(cadena || '').split(',')) {
    const i = par.indexOf(':');
    if (i < 1) continue;
    const persona = par.slice(0, i).trim();
    const token = par.slice(i + 1).trim();
    if (!PERSONAS[persona] || token.length < TOKEN_MIN) continue;
    mapa.set(token, persona);
  }
  return mapa;
}

/** Busca la persona de un token comparando en tiempo constante. */
export function personaPorToken(mapa, token) {
  if (typeof token !== 'string' || token.length < TOKEN_MIN) return null;
  const buf = Buffer.from(token);
  let encontrada = null;
  for (const [t, persona] of mapa) {
    const tb = Buffer.from(t);
    if (tb.length === buf.length && crypto.timingSafeEqual(tb, buf)) encontrada = persona;
  }
  return encontrada;
}

function hmac(cuerpo, secreto) {
  return crypto.createHmac('sha256', secreto).update(cuerpo).digest('base64url');
}

export function firmar(payload, secreto) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${cuerpo}.${hmac(cuerpo, secreto)}`;
}

/** Devuelve la persona de una cookie válida y vigente, o null. */
export function verificar(valor, secreto, ahora = Date.now()) {
  if (typeof valor !== 'string' || !secreto) return null;
  const punto = valor.indexOf('.');
  if (punto < 1) return null;
  const cuerpo = valor.slice(0, punto);
  const firma = valor.slice(punto + 1);
  const esperada = hmac(cuerpo, secreto);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')); } catch { return null; }
  if (!p || typeof p !== 'object' || !PERSONAS[p.p]) return null;
  if (typeof p.exp !== 'number' || !(p.exp > ahora)) return null;
  return p.p;
}

export const DIAS_SESION = 90;
export function crearSesion(persona, secreto, ahora = Date.now()) {
  if (!PERSONAS[persona]) throw new Error('persona desconocida');
  return firmar({ p: persona, exp: ahora + DIAS_SESION * 86400000, n: crypto.randomBytes(6).toString('base64url') }, secreto);
}

export function leerCookies(cabecera) {
  const out = {};
  for (const parte of String(cabecera || '').split(';')) {
    const i = parte.indexOf('=');
    if (i < 1) continue;
    const k = parte.slice(0, i).trim();
    try { out[k] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { out[k] = ''; }
  }
  return out;
}

export function cabeceraCookie(valor, { segura = false, maxAgeSegundos = DIAS_SESION * 86400 } = {}) {
  return `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSegundos}${segura ? '; Secure' : ''}`;
}

/** Middleware: deja `req.persona` (o null) a partir de la cookie. */
export function middlewareSesion(secreto) {
  return (req, _res, next) => {
    const c = leerCookies(req.headers.cookie);
    req.persona = verificar(c[COOKIE], secreto);
    next();
  };
}

export function requiereSesion(req, res, next) {
  if (!req.persona) return res.status(401).json({ error: 'sin_sesion' });
  next();
}
