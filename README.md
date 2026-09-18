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

`public/` es una app sin build ni dependencias: módulos ES (`type="module"`, CSP `script-src 'self'`, sin scripts
inline), rutas por hash y un shell de app (barra lateral en escritorio, barra inferior en móvil, cabecera con
búsqueda, "+ Nuevo", avisos y menú de persona, panel lateral para editar). Instalable como PWA (manifest e iconos).

```
public/
  index.html            shell; carga /app.js como módulo
  app.js                arranque: registro de módulos, ruteo, shell, panel, eventos, atajos, arrastre
  api.js                red: /api/*, SSE con sondeo de respaldo, escrituras optimistas con cola sin red,
                        registro del service worker y aviso de versión nueva
  cola.js               cola de escrituras pendientes (localStorage), una por clave; se prueba en Node
  buscar.js             búsqueda global (tareas, usuarios, oportunidades, mensajes); pura
  estado.js             estado del cliente, constantes del método (Plan v0.3), helpers de datos
  ruta.js               rutas #/<modulo>[/<id>] (puras, se prueban en Node)
  sw.js                 service worker: shell por versión + última foto de /api/estado para leer sin red
  ui/base.js            escape, fechas, iconos SVG, avatar, toast (con Deshacer), confirmar, panel, foco
  ui/piezas.js          tarjetas, renglones, señales, comentarios, actividad, mensajes, esqueletos
  ui/ayuda.js           panel de ayuda (?) : pestañas, atajos, cómo se guarda
  modulos/<nombre>.js   un módulo = un archivo: { id, titulo, icono, orden, principal, nuevo, badge, hot,
                        vista(), panel(id), acciones{}, binds{}, submits{}, filtros(), alMostrar(), alSalir() }
  estilos/{tokens,base,shell,componentes,modulos}.css
  manifest.webmanifest, iconos/
```

Agregar un módulo = un archivo en `modulos/` registrado en `app.js` **y en la lista `SHELL` de `sw.js`** (una
prueba lo verifica). Atajos: `/` buscar en todo, `n` nuevo en el módulo, `g` + `h/t/u/o/c/i/a` ir a un módulo,
`?` ayuda, `Escape` cierra menú, panel o búsqueda. En el teléfono la búsqueda es la lupa de la cabecera, los filtros
y las etapas se deslizan de lado, las tarjetas se mueven con su botón de flechas y Enter en el chat hace salto de
línea (se envía con el botón). Pestañas: **Hoy**, **Tareas**, **Usuarios de
prueba**, **Oportunidades**, **Chat**, **Iteración**, **Actividad** y **Ajustes** (tema, letra, sonido de mensajes,
semanas de la iteración, equipo y datos de la app). Filtros, orden y columnas plegadas de los tableros se recuerdan
por navegador (`localStorage`, clave `mp.filtros`); Ajustes puede restablecerlos. Cada elemento se abre en el panel lateral con
su ruta (`#/tareas/<id>`), así una liga abre directo la tarea.

**Guardado y red.** Cada cambio se manda al momento y la cabecera dice «guardando…» / «guardado». Si el servidor
responde con error se avisa y, si fue 5xx, el toast ofrece «Reintentar». Si no hay red, el cambio se aplica en
pantalla (tarjeta punteada «por enviar»), se guarda en `localStorage` (`mp.cola`, una operación por documento, la
última gana) y se envía en orden al volver la red (evento `online`, sondeo de 10 s o el botón «N por enviar» de la
cabecera). Una operación que el servidor rechaza se descarta y manda el estado real. Al salir se vacía la cola.
Cada petición tiene límite de tiempo (`TIEMPOS` en `api.js`: lectura 12 s, escritura 15 s) porque una red que tira
paquetes no rechaza la conexión y el navegador tardaría ~2 min en fallar. Al vencer, un PUT o DELETE se encola (son
idempotentes); un mensaje (POST) no, porque pudo haber llegado: se avisa, se recarga el estado y el texto vuelve a la
caja. Borrar un mensaje que aún no salía retira su envío de la cola.

**Service worker.** El servidor sirve `/sw.js` con la versión del deploy inyectada (`K_REVISION` en Cloud Run,
`dev-<hora>` en local; `/version.json` la expone). Cada versión precachea el shell completo en su propia caché
(`mindprint-<versión>`, con `cache: 'reload'` para saltar la caché HTTP) y lo sirve siempre desde ahí: nunca se
mezclan archivos de dos deploys. `/api/estado` va a la red y, si falla o no contesta en 8 s, se devuelve la última copia con la
cabecera `X-Mindprint-Offline: 1` (la petición sigue en segundo plano y refresca la copia); la app muestra el aviso «Sin conexión» y sigue funcionando en lectura y con la
cola. Cuando hay versión nueva, la app la instala aparte y ofrece «Actualizar» (cabecera y toast); al aceptar,
el SW nuevo toma control y la página se recarga. `/salir` borra la copia del estado.

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
  (la iteración lleva `semanas` 4–8 y los 9 artefactos del Plan v0.3: oportunidad, proceso_tipo, solucion, prototipo,
  demo_doc, usuarios, senales, costos, decision; los prospectos llevan `senales` y `relacion`)
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
