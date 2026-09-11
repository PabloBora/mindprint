# Tablero Mindprint

Herramienta de seguimiento del equipo Mindprint (Pablo, Max, Daniel): ideas por etapa con votos y
criterios, tareas por estado y responsable, e iteración con fases, artefactos y decisiones.
Un servicio Node + Express, datos en Firestore, entrada por liga personal sin contraseña.

## Correr local

```bash
npm install
npm run dev          # backend en memoria (persiste en .datos-dev.json), puerto 8080
```

Ligas de desarrollo (solo valen con `npm run dev`):
`http://localhost:8080/entrar/dev-local-pablo-0000000` · `…/entrar/dev-local-max-000000000` · `…/entrar/dev-local-daniel-000000`

```bash
npm test             # pruebas (node:test)
npm run check        # sintaxis de todo el JS
```

## Interfaz

`public/` es HTML + CSS + JS sin build ni dependencias (`index.html`, `estilos.css`, `app.js`). El CSP del
servidor solo permite `script-src 'self'`, así que no hay scripts inline. La interfaz carga `/api/estado`,
se conecta a `/api/eventos` (SSE) y, si eso falla, sondea cada 10 s. Sin sesión muestra la pantalla de
entrada (pegar la liga personal).

Pestañas: **Hoy** (centro de trabajo: iteración compacta, lo mío con alta rápida, prospectos en juego, el
equipo, pendientes de la fase, últimos movimientos) · **Tareas** (tablero por estado con arrastre y diálogo) ·
**Prospectos** (el embudo comercial del Plan Maestro: selección → descubrimiento → caso de negocio →
propuesta → piloto → conversión o descartado; diálogo con contacto, razón, dolor, baseline y siguiente paso) ·
**Casos de uso** (tablero por etapa con votos y criterios; colección `ideas`) · **Chat** (mensajes del equipo con no leídos, menciones
`@nombre`, ligas auto-enlazadas y referencias clicables) · **Iteración** (fases, datos, artefactos, decisiones) ·
**Actividad** (todo lo que pasó, por día). Los diálogos de tarea e idea llevan al pie su hilo de comentarios,
que son mensajes con referencia y también salen en el Chat.

## Configuración

| Variable | Qué es |
|---|---|
| `PORT` | Puerto HTTP (Cloud Run lo inyecta). |
| `DATA_BACKEND` | `firestore` (default) o `memory`. |
| `DATA_FILE` | Solo `memory`: archivo JSON donde persistir (opcional). |
| `GOOGLE_CLOUD_PROJECT` | Proyecto de Firestore fuera de Cloud Run (dentro se infiere). |
| `MP_SECRET` | Secreto HMAC que firma las cookies de sesión. Mínimo 16 caracteres; usa 32 bytes aleatorios. |
| `MP_TOKENS` | Ligas personales: `pablo:<token>,max:<token>,daniel:<token>` (token ≥ 16 caracteres). |
| `NODE_ENV` | `production` fuerza https (301), HSTS y cookie `Secure`. El Dockerfile ya lo pone. |

Sin `MP_SECRET` válido o sin ninguna liga válida en `MP_TOKENS`, el servidor **no arranca**.

## Entrada sin contraseña: cómo funciona y qué implica

1. `npm run tokens -- https://<url-del-servicio>` imprime un `MP_SECRET` nuevo, un `MP_TOKENS` nuevo y
   una liga por persona (`/entrar/<token>`).
2. Los dos valores van a Secret Manager; cada persona recibe **solo su liga** por un canal privado.
3. Abrir la liga deja una cookie firmada (`mp_sesion`, httpOnly, SameSite=Lax, Secure en producción)
   válida 90 días. `/salir` la borra.

**Riesgo aceptado:** la liga lleva la credencial en la URL, así que queda en el historial del navegador
y en los logs de peticiones de Cloud Run. Es el precio de no pedir contraseña a tres personas. Por eso:
- No se comparte la liga en canales públicos ni se pega en documentos compartidos.
- **Rotación:** volver a correr `npm run tokens`, actualizar **ambos** secretos y redeployar. Rotar solo
  `MP_TOKENS` no cierra las sesiones abiertas: las cookies dependen de `MP_SECRET`.

## API (resumen)

Todo bajo `/api/*` exige la cookie; sin ella responde `401 {"error":"sin_sesion"}`.

- `GET /api/estado` → `{version, yo, personas, ideas[], tareas[], prospectos[], mensajes[], iteracion, actividad[], enLinea[]}`
- `PUT /api/ideas/:id` · `DELETE /api/ideas/:id` — el servidor valida, sella `actualizado`/`actualizadoPor`
  y aplica el tope de 3 votos por persona (`409 {"error":"sin_votos"}`).
- `PUT /api/tareas/:id` · `DELETE /api/tareas/:id` · `PUT /api/prospectos/:id` · `DELETE /api/prospectos/:id` · `PUT /api/iteracion`
  (la iteración lleva `semanas` 4–8 y los 9 artefactos del Plan Maestro: caso, prospecto, mapa, caso_negocio, demo,
  doc_interna, propuesta, costos, decision)
- `POST /api/mensajes` `{texto, ref?}` → `201 {ok, version, doc}` (chat sin `ref`; comentario con `ref: {tipo: idea|tarea|prospecto, id}`,
  el servidor rellena `titulo`; ref a algo inexistente → 400) · `DELETE /api/mensajes/:id` (solo el autor; ajeno → `403 {"error":"ajeno"}`).
  `GET /api/estado` trae `mensajes[]` (últimos 500, ascendente).
- `GET /api/eventos` — SSE: `hola {version}` al conectar, `cambio {version}` tras cada escritura,
  `presencia {enLinea[]}` al entrar/salir alguien, `retry: 3000`, ping cada 25 s.
- `GET /salud` → `{ok, backend, version}` (sin cookie).
- `POST /api/reto` → `501` (Reto de Claude: fuera de alcance v1).

`version` es un marcador de "algo cambió": arranca en la hora del proceso y sube con cada escritura.
Compárala con `!==`; no asumas incrementos de uno.

## Datos

Backends intercambiables en `src/datos/` con la misma interfaz. Colecciones Firestore: `ideas`,
`tareas`, `prospectos`, `mensajes` (un doc por mensaje; se cargan los últimos 500), documentos `iteracion/actual` y `actividad/reciente` (últimos 100 eventos).
El servidor mantiene una copia en memoria y **todas las escrituras van en serie**; por eso el servicio
corre con **una sola instancia** (`--max-instances 1`).

Importar un respaldo o los datos del Artifact original:

```bash
DATA_BACKEND=firestore GOOGLE_CLOUD_PROJECT=<id> node scripts/importar.mjs datos.json
```

## Deploy

El checklist completo (proyecto GCP, Firestore, secretos, `gcloud run deploy`, smoke y rollback) vive
en el `CLAUDE.md` del proyecto Mindprint. Ningún deploy sin aprobación explícita de Pablo.
