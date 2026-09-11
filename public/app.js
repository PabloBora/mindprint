/* Tablero Mindprint — interfaz. Consume el API del servidor (ver README). Sin dependencias. */
(() => {
  'use strict';

  /* ---------- constantes del método (v0.1) ---------- */
  const PERSONAS = {
    pablo: { nombre: 'Pablo', rol: 'Tecnología y desarrollo' },
    max: { nombre: 'Max', rol: 'Procesos' },
    daniel: { nombre: 'Daniel', rol: 'Cliente y negocio · apoyo en desarrollo' },
  };
  const RESP = { pablo: 'Pablo', max: 'Max', daniel: 'Daniel', todos: 'Los tres' };
  const STAGES = [['semilla', 'Detectada'], ['explorada', 'Explorada'], ['candidata', 'Candidata'], ['elegida', 'Elegida'], ['descartada', 'Descartada']];
  const PHASES = [['elegir', 'Detectar', 'sem 0–1'], ['entender', 'Explorar', 'sem 1–2'], ['construir', 'Construir', 'sem 2–4'], ['validar', 'Probar', 'sem 4–6'], ['decidir', 'Decidir', 'cierre']];
  const FASES = Object.fromEntries([['general', 'General'], ...PHASES.map((p) => [p[0], p[1]])]);
  const ESTADOS = [['pendiente', 'Pendiente'], ['en_curso', 'En curso'], ['bloqueada', 'Bloqueada'], ['hecha', 'Hecha']];
  const CRIT = [['comun', 'Frecuente y común'], ['dolor', 'Dolor evidente'], ['estandar', 'Entradas y salidas estándar'], ['construible', 'Lo podemos construir']];
  const REACC = [['late', 'Me late'], ['dudo', 'Dudo'], ['cliente', 'Tengo cliente']];
  const ARTEF = [['oportunidad', 'Oportunidad elegida, con razón', 'elegir'], ['proceso_tipo', 'Mapa del proceso tipo (varias empresas)', 'entender'], ['solucion', 'Solución rápida en una frase, y qué queda fuera', 'entender'], ['prototipo', 'Prototipo con medición de uso', 'construir'], ['demo_doc', 'Demo interna y documentación breve', 'construir'], ['usuarios', 'Usuarios de prueba elegidos', 'validar'], ['senales', 'Señales de tracción registradas', 'validar'], ['costos', 'Costo por ejecución medido', 'validar'], ['decision', 'Decisión de cierre: productizar / ajustar / descartar', 'decidir']];
  const ETAPAS_P = [['candidato', 'Candidato'], ['contactado', 'Contactado'], ['probando', 'Probando'], ['jala', 'Jala'], ['descartado', 'Descartado']];
  const SENALES = [['prueba', 'La prueba sin que insistamos'], ['repite', 'La vuelve a usar por su cuenta'], ['pide', 'Pide algo más'], ['recomienda', 'La recomienda o preguntan por ella'], ['pagaria', 'Pagaría algo por uso']];
  const TIPOS_DEC = [['seguir', 'Seguir'], ['ajustar', 'Ajustar'], ['descartar', 'Descartar'], ['otra', 'Otra']];
  const VOTOS_MAX = 3;
  const semanasDe = (it) => (it && it.semanas) || 6;
  const PROVOCACIONES = [
    '¿Qué proceso repetitivo viste esta semana que alguien hace a mano y nadie cuestiona?',
    '¿Quién paga hoy, en horas o en dinero, por mover información de un sistema a otro?',
    '¿Qué cliente ya nos tiene confianza y nos dejaría ver su operación sin ceremonia?',
    '¿Qué haría un agente que trabaja 24/7 en esa oficina, si solo pudiera leer y proponer?',
    '¿Dónde se pierde una venta o un cobro porque nadie dio seguimiento a tiempo?',
    '¿Qué decisión chica se toma cien veces al día con la misma regla?',
    '¿Qué reporte se arma cada semana copiando y pegando de tres lugares?',
    '¿Qué pregunta le hacen al dueño diez veces al día que podría responder un agente?',
    '¿Qué trámite o formato obligatorio se llena siempre con los mismos datos?',
    '¿Qué proceso ya intentaron automatizar y fracasó? ¿Por qué falló y qué cambió desde entonces?',
  ];

  /* ---------- estado de la interfaz ---------- */
  const S = {
    estado: null, yo: null, enLinea: [], sinSesion: false, conexion: 'conectando', errEntrada: '',
    tab: lsGet('mp.tab.v2', 'hoy'), stage: 'semilla', fAutor: 'todos', q: '', fResp: lsGet('mp.fresp', 'todas'), fFase: 'todas', colT: 'pendiente', verHechas: false, arrastrandoKind: 'idea',
    openIdea: null, openTarea: null, openProspecto: null, fRespP: 'todas', colP: 'candidato', leido: lsGet('mp.chat.leido', ''), prov: Math.floor(Math.random() * PROVOCACIONES.length), arrastrando: null, tipoDec: 'otra',
  };
  let es = null;
  const timers = {};

  /* ---------- utilidades ---------- */
  function lsGet(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* sin storage */ } }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const pad = (n) => String(n).padStart(2, '0');
  function hoy() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fmtDia(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${parseInt(m[3], 10)} ${MESES[parseInt(m[2], 10) - 1]}` : ''; }
  function fmtFechaHora(iso) { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getDate()} ${MESES[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function relTiempo(iso) {
    const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'ahora'; if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`; if (s < 86400 * 1.5) return `hace ${Math.round(s / 3600)} h`;
    if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} d`; return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }
  function diaDe(iso) { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function etiquetaDia(ymd) { const h = hoy(); if (ymd === h) return 'Hoy'; const a = new Date(); a.setDate(a.getDate() - 1); if (ymd === diaDe(a.toISOString())) return 'Ayer'; return fmtDia(ymd); }
  function diasHasta(ymd) { if (!ymd) return null; const a = new Date(`${hoy()}T00:00:00`); const b = new Date(`${ymd}T00:00:00`); return Math.round((b - a) / 86400000); }
  function semanaDe(inicio) { if (!inicio) return null; const d = new Date(`${inicio}T00:00:00`); if (Number.isNaN(d.getTime())) return null; return Math.max(0, Math.floor((Date.now() - d.getTime()) / (7 * 86400000))); }
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800); }
  const ligaSegura = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim());
  /* Después de entrar, nombres y roles vienen del servidor; antes (pantalla de entrada) se usa la copia local. */
  const P = () => (S.estado && S.estado.personas) || PERSONAS;
  const nombre = (p) => (P()[p] ? P()[p].nombre : RESP[p] || '');
  const avatar = (p, extra = '') => (p && (P()[p] || p === 'todos') ? `<span class="av ${esc(p)} ${extra}" title="${esc(nombre(p))}">${p === 'todos' ? '3' : esc(nombre(p)[0])}</span>` : '');

  /* ---------- red ---------- */
  async function api(metodo, ruta, cuerpo) {
    const r = await fetch(ruta, { method: metodo, credentials: 'same-origin', headers: cuerpo ? { 'content-type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    if (r.status === 401) { mostrarEntrada(); const e = new Error('sin_sesion'); e.code = 'sin_sesion'; throw e; }
    let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok) { const e = new Error((j && j.detalle) || (j && j.error) || `HTTP ${r.status}`); e.code = (j && j.error) || 'error'; e.status = r.status; throw e; }
    return j;
  }
  function mensajeError(e) {
    if (e.code === 'sin_votos') return `Ya usaste tus ${VOTOS_MAX} votos. Quita uno de otra oportunidad para votar esta.`;
    if (e.code === 'titulo_requerido') return 'Falta el título.';
    if (e.status >= 500 || !e.status) return 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
    return e.message;
  }
  async function cargarEstado() {
    try {
      const j = await api('GET', '/api/estado');
      S.estado = j; S.yo = j.yo; S.enLinea = j.enLinea || []; S.sinSesion = false;
      if (S.conexion !== 'live') S.conexion = es && es.readyState === 1 ? 'live' : 'poll';
      render();
    } catch (e) { if (e.code !== 'sin_sesion') { S.conexion = 'bad'; render(); } }
  }
  function conectarSSE() {
    if (!('EventSource' in window)) { S.conexion = 'poll'; return; }
    if (es) es.close();
    es = new EventSource('/api/eventos');
    es.addEventListener('hola', (ev) => { S.conexion = 'live'; const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); else renderHeader(); });
    es.addEventListener('cambio', (ev) => { const v = JSON.parse(ev.data).version; if (!S.estado || v !== S.estado.version) cargarEstado(); });
    es.addEventListener('presencia', (ev) => { S.enLinea = JSON.parse(ev.data).enLinea || []; renderHeader(); });
    es.onerror = () => { if (S.conexion === 'live') { S.conexion = 'poll'; renderHeader(); } };
  }
  function mostrarEntrada() {
    S.sinSesion = true; S.estado = null; S.yo = null;
    if (es) { es.close(); es = null; }
    const d = document.getElementById('dlg'); if (d.open) d.close();
    render();
  }
  setInterval(() => { if (S.sinSesion) return; if (!es || es.readyState !== 1) cargarEstado(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !S.sinSesion) { cargarEstado(); if (es && es.readyState === 2) conectarSSE(); } });

  const sinSellos = (d) => { const o = { ...d }; delete o.actualizado; delete o.actualizadoPor; return o; };
  function upsert(lista, doc) { const i = lista.findIndex((x) => x.id === doc.id); if (i >= 0) lista[i] = doc; else lista.push(doc); }
  async function guardarIdea(idea) {
    try { const j = await api('PUT', `/api/ideas/${encodeURIComponent(idea.id)}`, sinSellos(idea)); upsert(S.estado.ideas, j.doc); S.estado.version = j.version; render(); return true; }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } return false; }
  }
  async function borrarIdea(id) {
    try { const j = await api('DELETE', `/api/ideas/${encodeURIComponent(id)}`); S.estado.ideas = S.estado.ideas.filter((i) => i.id !== id); S.estado.version = j.version; render(); }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } }
  }
  async function guardarTarea(t) {
    try { const j = await api('PUT', `/api/tareas/${encodeURIComponent(t.id)}`, sinSellos(t)); upsert(S.estado.tareas, j.doc); S.estado.version = j.version; render(); return true; }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } return false; }
  }
  async function borrarTarea(id) {
    try { const j = await api('DELETE', `/api/tareas/${encodeURIComponent(id)}`); S.estado.tareas = S.estado.tareas.filter((t) => t.id !== id); S.estado.version = j.version; render(); }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } }
  }
  async function guardarIteracion(it) {
    try { const j = await api('PUT', '/api/iteracion', it); S.estado.iteracion = j.doc; S.estado.version = j.version; render(); return true; }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } return false; }
  }

  /* ---------- helpers de datos ---------- */
  const ideaById = (id) => S.estado.ideas.find((i) => i.id === id);
  const tareaById = (id) => S.estado.tareas.find((t) => t.id === id);
  const yo = () => (S.yo ? S.yo.persona : '');
  function votosUsados(p) { return S.estado.ideas.reduce((a, i) => a + ((i.votos || {})[p] || 0), 0); }
  const votosIdea = (i) => Object.values(i.votos || {}).reduce((a, b) => a + (b || 0), 0);
  const scoreIdea = (i) => { const c = i.criterios || {}; return (c.acceso || 0) + (c.dolor || 0) + (c.agentizable || 0); };
  function reaccCount(i) { const out = {}; Object.values(i.reacciones || {}).forEach((v) => { if (v) out[v] = (out[v] || 0) + 1; }); return out; }
  const sortIdeas = (a, b) => (votosIdea(b) - votosIdea(a)) || (scoreIdea(b) - scoreIdea(a)) || String(a.creado || '').localeCompare(String(b.creado || ''));
  const esMia = (t) => t.responsable === yo() || t.responsable === 'todos';
  const vencida = (t) => t.vence && t.estado !== 'hecha' && t.vence < hoy();

  /* ---------- render ---------- */
  function captureFocus(root) {
    const a = document.activeElement; if (!a || !root.contains(a) || !a.dataset || !(a.dataset.bind || a.dataset.keep)) return null;
    return { key: a.dataset.bind || a.dataset.keep, s: a.selectionStart, e: a.selectionEnd, value: a.value };
  }
  const esCampoTexto = (el) => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'date', 'number'].includes(el.type));
  function restoreFocus(root, k) {
    if (!k) return; const el = root.querySelector(`[data-bind="${k.key}"],[data-keep="${k.key}"]`); if (!el) return;
    // Lo que la persona está tecleando manda sobre lo que llegó del servidor: un cambio remoto
    // a media frase no le borra el texto (su guardado pendiente lo enviará en <1 s).
    if (esCampoTexto(el) && el.value !== k.value) el.value = k.value;
    el.focus({ preventScroll: true }); try { if (k.s != null && el.setSelectionRange) el.setSelectionRange(k.s, k.e); } catch { /* no aplica */ }
  }
  function render() {
    const app = document.getElementById('app');
    const keep = captureFocus(app);
    if (S.sinSesion) { app.innerHTML = viewEntrada(); restoreFocus(app, keep); return; }
    if (!S.estado) { app.innerHTML = S.conexion === 'bad' ? '<div class="vacio"><b>No se pudo cargar el tablero.</b> Revisa tu conexión; se reintenta solo cada 10 segundos.</div>' : '<div class="vacio">Cargando el tablero…</div>'; return; }
    const log0 = document.getElementById('chat-log'); const abajo = !log0 || (log0.scrollHeight - log0.scrollTop - log0.clientHeight < 80); const scrollPrev = log0 ? log0.scrollTop : 0;
    app.innerHTML = viewHeader() + viewTabs() + viewPanel() + viewFoot();
    restoreFocus(app, keep);
    const log1 = document.getElementById('chat-log'); if (log1) log1.scrollTop = abajo ? log1.scrollHeight : scrollPrev;
    if (S.openIdea) renderDlg(); else if (S.openTarea) renderDlgTarea(); else if (S.openProspecto) renderDlgProspecto();
  }
  function renderHeader() { const h = document.getElementById('cabecera'); if (h && S.estado) h.outerHTML = viewHeader(); }
  function viewPanel() { if (S.tab === 'tareas') return viewTareas(); if (S.tab === 'prospectos') return viewProspectos(); if (S.tab === 'ideas') return viewIdeas(); if (S.tab === 'chat') return viewChat(); if (S.tab === 'iter') return viewIter(); if (S.tab === 'actividad') return viewActividad(); return viewHoy(); }
  function viewFoot() {
    return '<div class="foot-links"><a href="https://docs.google.com/document/d/1VihQ50vREEp9m3yqD7ek7wDx0Z1pOueF3BC_ICT9JhA/edit" target="_blank" rel="noopener">Doc del método v0.1</a><a href="https://drive.google.com/drive/folders/1RiT2jf0FVqJdx-KTnQBxuYEWU7-CnKW-" target="_blank" rel="noopener">Carpeta Mindprint en Drive</a></div>';
  }

  /* ---- entrada ---- */
  function viewEntrada() {
    return `<div class="entrada"><div class="card-e">
      <h1 class="mark">Mindprint <small>tablero</small></h1>
      <p>Aquí trabajan tres personas. Se entra con una liga personal, sin contraseña.</p>
      <div class="personas">${Object.keys(P()).map((p) => `<div class="persona">${avatar(p, 'lg')}<span class="nom">${esc(P()[p].nombre)}</span><span class="rol">${esc(P()[p].rol)}</span></div>`).join('')}</div>
      <form data-act="entrar"><input class="in" id="liga" data-keep="liga" placeholder="Pega tu liga personal" autocomplete="off" required><button class="btn primary" type="submit">Entrar</button></form>
      ${S.errEntrada ? `<div class="err">${esc(S.errEntrada)}</div>` : ''}
      <div class="ayuda">Pablo te la mandó por privado. Si ya habías entrado en este navegador y ves esto, tu sesión venció (dura 90 días): vuelve a abrir tu liga.</div>
    </div></div>`;
  }

  /* ---- cabecera y pestañas ---- */
  function viewHeader() {
    const me = yo();
    const otros = Object.keys(P()).filter((p) => p !== me);
    const cx = { conectando: ['', 'conectando…'], live: ['on', 'en vivo'], poll: ['warn', 'actualizando cada 10 s'], bad: ['bad', 'sin conexión'] }[S.conexion] || ['', ''];
    const online = (p) => (S.enLinea.includes(p) ? '<i class="on"></i>' : '');
    return `<header class="top" id="cabecera">
      <h1 class="mark">Mindprint <small>tablero</small></h1>
      <div class="yo">${avatar(me, 'lg').replace('</span>', `${online(me)}</span>`)}<div><div class="nom">${esc(S.yo.nombre)}</div><div class="rol">${esc(S.yo.rol)}</div></div></div>
      <div class="equipo">${otros.map((p) => avatar(p, S.enLinea.includes(p) ? '' : 'off').replace('</span>', `${online(p)}</span>`)).join('')}<span>${otros.filter((p) => S.enLinea.includes(p)).map(nombre).join(' y ') || 'nadie más'} en línea</span></div>
      <div class="right"><span class="sync"><span class="dot ${cx[0]}"></span>${cx[1]}</span><a class="lnk" href="/salir">Salir</a></div>
    </header>`;
  }
  function viewTabs() {
    const mias = S.estado.tareas.filter((t) => esMia(t) && t.estado !== 'hecha');
    const hot = mias.some(vencida);
    const it = S.estado.iteracion;
    const abiertas = S.estado.tareas.filter((t) => t.estado !== 'hecha').length;
    const tabs = [['hoy', 'Hoy', String(mias.length), hot ? 'hot' : ''], ['tareas', 'Tareas', String(abiertas), ''], ['prospectos', 'Usuarios de prueba', String(S.estado.prospectos.filter(enJuego).length), ''], ['ideas', 'Oportunidades', String(S.estado.ideas.length), ''], ['chat', 'Chat', noLeidos() ? String(noLeidos()) : '', noLeidos() ? 'hot' : ''], ['iter', 'Iteración', `#${it.numero} · ${FASES[it.fase] || it.fase}`, ''], ['actividad', 'Actividad', '', '']];
    return `<nav class="tabs" role="tablist">${tabs.map((t) => `<button class="tab" role="tab" data-act="tab" data-tab="${t[0]}" aria-selected="${S.tab === t[0]}">${t[1]}${t[2] ? `<span class="n ${t[3]}">${esc(t[2])}</span>` : ''}</button>`).join('')}</nav>`;
  }

  /* ---- ideas ---- */
  function viewIdeas() {
    const ideas = S.estado.ideas;
    const q = S.q.trim().toLowerCase();
    const visibles = ideas.filter((i) => (S.fAutor === 'todos' || i.autor === S.fAutor) && (!q || `${i.titulo} ${i.dolor} ${i.quien} ${i.agente}`.toLowerCase().includes(q)));
    const cand = ideas.filter((i) => i.etapa === 'candidata').length; const eleg = ideas.filter((i) => i.etapa === 'elegida').length;
    const quedan = Math.max(0, VOTOS_MAX - votosUsados(yo()));
    let h = '<div class="panel">';
    h += '<form class="addform" data-act="add-idea"><input class="in" id="idea-new" data-keep="idea-new" placeholder="Una oportunidad en una frase: qué proceso repetitivo automatizaríamos. El resto se llena después. (tecla n)" maxlength="140" autocomplete="off" required><button class="btn primary" type="submit">Agregar oportunidad</button></form>';
    h += `<div class="sub"><span><b>${ideas.length}</b> oportunidades</span><span><b>${cand}</b> candidatas</span><span><b>${eleg}</b> elegidas</span><span class="mono">te quedan <b>${quedan}</b> de ${VOTOS_MAX} votos</span><span>Se ordenan por votos y luego por criterios.</span></div>`;
    h += `<div class="toolbar"><div class="chips"><button class="chip" data-act="fautor" data-v="todos" aria-pressed="${S.fAutor === 'todos'}">Todas</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="fautor" data-v="${p}" aria-pressed="${S.fAutor === p}">${avatar(p)}${esc(P()[p].nombre)}</button>`).join('')}</div><input class="in search" id="q" data-keep="q" placeholder="Buscar oportunidades" value="${esc(S.q)}" aria-label="Buscar"></div>`;
    h += `<div class="stagebar chips">${STAGES.map((s) => `<button class="chip" data-act="stage" data-s="${s[0]}" aria-pressed="${S.stage === s[0]}">${s[1]} <span class="tag">${visibles.filter((i) => i.etapa === s[0]).length}</span></button>`).join('')}</div>`;
    if (!ideas.length) h += '<div class="vacio"><b>Todavía no hay oportunidades.</b> Escribe la primera arriba: con el título basta. Después abre la tarjeta para contar el dolor, quién paga y qué haría el agente, y califica los cuatro criterios. Cada quien tiene 3 votos para empujar las que más le laten.</div>';
    h += '<div class="board">';
    for (const [k, label] of STAGES) {
      const items = visibles.filter((i) => i.etapa === k).sort(sortIdeas);
      h += `<section class="col${S.stage === k ? ' active' : ''}${items.length ? '' : ' empty'}" data-col="${k}" data-kind="idea"><h3><span class="${k === 'elegida' ? 'hl' : ''}">${label}</span><span class="n">${items.length}</span></h3><div class="cards">${items.map(cardIdea).join('')}</div></section>`;
    }
    h += '</div></div>';
    return h;
  }
  function cardIdea(i) {
    const c = i.criterios || {}; const rc = reaccCount(i); const v = i.votos || {};
    const rx = REACC.filter((r) => rc[r[0]]).map((r) => `${rc[r[0]]} ${r[1].toLowerCase()}`).join(' · ');
    const voters = Object.keys(P()).filter((p) => v[p]);
    return `<div class="card" role="button" tabindex="0" draggable="true" data-kind="idea" data-act="open" data-id="${esc(i.id)}">
      <div class="t">${esc(i.titulo || '(sin título)')}</div>
      ${i.dolor ? `<div class="d">${esc(i.dolor)}</div>` : ''}
      <div class="meta">${i.autor ? avatar(i.autor, 'sm') : ''}
        <span class="crit" title="común · dolor · estándar · construible">${CRIT.map((k) => `<i class="l${c[k[0]] || 0}"></i>`).join('')}</span>
        <span class="votos" title="votos">▲ ${votosIdea(i)}${voters.length ? ` <span class="avs">${voters.map((p) => avatar(p, 'sm')).join('')}</span>` : ''}</span>
        ${rx ? `<span class="rx">${esc(rx)}</span>` : ''}${comentariosDe('idea', i.id).length ? `<span class="tag">${comentariosDe('idea', i.id).length} coment.</span>` : ''}
      </div></div>`;
  }
  function renderDlg() {
    const dlg = document.getElementById('dlg'); const i = ideaById(S.openIdea);
    if (!i) { S.openIdea = null; if (dlg.open) dlg.close(); return; }
    const keep = captureFocus(dlg);
    const c = i.criterios || {}; const v = i.votos || {}; const r = i.reacciones || {}; const me = yo();
    const mine = v[me] || 0; const quedan = Math.max(0, VOTOS_MAX - votosUsados(me));
    const B = (f) => `data-bind="ideas:${esc(i.id)}:${f}"`;
    let h = '<div class="dlg"><div class="main">';
    h += `<div class="seg">${STAGES.map((s) => `<button type="button" data-act="etapa" data-id="${esc(i.id)}" data-s="${s[0]}" aria-pressed="${i.etapa === s[0]}">${s[1]}</button>`).join('')}</div>`;
    h += `<input class="title" ${B('titulo')} value="${esc(i.titulo)}" maxlength="140" aria-label="Título">`;
    h += `<div class="field"><label>El dolor, en una frase</label><textarea class="in" rows="2" ${B('dolor')} placeholder="Qué duele hoy y a quién">${esc(i.dolor)}</textarea></div>`;
    h += `<div class="field"><label>Quién lo sufre o quién paga</label><textarea class="in" rows="1" ${B('quien')} placeholder="Rol, tipo de empresa, cliente concreto si lo hay">${esc(i.quien)}</textarea></div>`;
    h += `<div class="field"><label>Qué haría el agente</label><textarea class="in" rows="2" ${B('agente')} placeholder="Lee, propone, ejecuta… hasta dónde llega">${esc(i.agente)}</textarea></div>`;
    h += `<div class="field"><label>Cómo sabríamos que vale</label><textarea class="in" rows="2" ${B('validacion')} placeholder="La señal del cliente que nos haría seguir">${esc(i.validacion)}</textarea></div>`;
    h += `<div class="field"><label>Notas</label><textarea class="in" rows="2" ${B('notas')}>${esc(i.notas)}</textarea></div>`;
    h += seccionComentarios('idea', i.id);
    h += '</div><div class="side">';
    h += `<div class="field"><label>Quién la propone</label><select class="in" ${B('autor')}><option value="">—</option>${Object.keys(P()).map((p) => `<option value="${p}"${i.autor === p ? ' selected' : ''}>${esc(P()[p].nombre)}</option>`).join('')}</select></div>`;
    h += `<div class="field"><label>Tus votos en esta oportunidad</label><div class="votebox"><button class="btn sm" type="button" data-act="voto" data-id="${esc(i.id)}" data-d="-1"${mine <= 0 ? ' disabled' : ''}>−</button><span class="num">${mine}</span><button class="btn sm" type="button" data-act="voto" data-id="${esc(i.id)}" data-d="1"${quedan <= 0 ? ' disabled' : ''}>+</button><span class="tag">te quedan ${quedan} · total ▲ ${votosIdea(i)}</span></div>`;
    const voters = Object.keys(P()).filter((p) => v[p]);
    h += `<div class="voters">${voters.length ? voters.map((p) => `<span>${avatar(p, 'sm')}${esc(P()[p].nombre)} ${v[p]}</span>`).join('') : '<span class="tag">nadie ha votado</span>'}</div></div>`;
    h += `<div class="field"><label>Criterios</label>${CRIT.map((k) => `<div class="critrow"><span>${k[1]}</span><div class="seg l2">${[['0', 'no', ''], ['1', 'algo', 'w'], ['2', 'sí', 'g']].map((o) => `<button type="button" class="${o[2]}" data-act="crit" data-id="${esc(i.id)}" data-k="${k[0]}" data-v="${o[0]}" aria-pressed="${String(c[k[0]] || 0) === o[0]}">${o[1]}</button>`).join('')}</div></div>`).join('')}</div>`;
    const rc = reaccCount(i); const rxs = REACC.filter((x) => rc[x[0]]).map((x) => `${x[1]} ${rc[x[0]]}`).join(' · ');
    h += `<div class="field"><label>Tu reacción</label><div class="chips">${REACC.map((x) => `<button type="button" class="chip" data-act="reacc" data-id="${esc(i.id)}" data-r="${x[0]}" aria-pressed="${r[me] === x[0]}">${x[1]}</button>`).join('')}</div>${rxs ? `<span class="tag">${esc(rxs)}</span>` : ''}</div>`;
    h += '</div>';
    h += `<div class="foot"><span>creada ${fmtFechaHora(i.creado)}${i.actualizadoPor ? ` · editada por ${esc(nombre(i.actualizadoPor))} ${relTiempo(i.actualizado)}` : ''}</span><span><button class="btn quiet danger sm" type="button" data-act="del-idea" data-id="${esc(i.id)}">Eliminar</button> <button class="btn sm" type="button" data-act="close">Cerrar</button></span></div>`;
    h += '</div>';
    dlg.innerHTML = h; restoreFocus(dlg, keep);
    if (!dlg.open) dlg.showModal();
  }

  /* ---- helpers compartidos (tareas, hoy, actividad) ---- */
  function pillVence(t) {
    if (!t.vence) return '';
    if (t.estado === 'hecha') return `<span class="tag">${fmtDia(t.vence)}</span>`;
    const d = diasHasta(t.vence);
    if (d < 0) return `<span class="pill bad">vencida ${fmtDia(t.vence)}</span>`;
    if (d === 0) return '<span class="pill warn">vence hoy</span>';
    if (d === 1) return '<span class="pill warn">vence mañana</span>';
    return `<span class="tag">vence ${fmtDia(t.vence)}</span>`;
  }
  const ordenTareas = (a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9')) || String(a.creado || '').localeCompare(String(b.creado || ''));
  const pillEstado = (t) => (t.estado === 'en_curso' ? '<span class="pill soft">en curso</span>' : t.estado === 'bloqueada' ? `<span class="pill bad">bloqueada${t.motivo ? `: ${esc(t.motivo)}` : ''}</span>` : '');
  function textoActividad(a) {
    const OBJ = { idea: 'la oportunidad', tarea: 'la tarea', prospecto: 'el usuario de prueba', iteracion: 'la iteración' };
    const obj = OBJ[a.objeto] || a.objeto; const t = `«${esc(a.titulo || '')}»`;
    if (a.accion === 'crea') return `creó ${obj} <b>${t}</b>`;
    if (a.accion === 'borra') return `borró ${obj} <b>${t}</b>`;
    if (a.accion === 'decide') return `registró una decisión <span class="pill soft">${esc(a.detalle || 'otra')}</span> <b>${t}</b>`;
    if (a.accion === 'mueve') {
      const dest = a.objeto === 'idea' ? (STAGES.find((s) => s[0] === a.detalle) || [])[1] : a.objeto === 'tarea' ? (ESTADOS.find((s) => s[0] === a.detalle) || [])[1] : a.objeto === 'prospecto' ? etiquetaEtapaP(a.detalle) : FASES[a.detalle];
      return a.objeto === 'iteracion' ? `pasó la iteración a <b>${esc(dest || a.detalle)}</b>` : `movió ${obj} <b>${t}</b> a <b>${esc(dest || a.detalle || '')}</b>`;
    }
    return `editó ${obj} <b>${t}</b>`;
  }
  function itemActividad(a) {
    return `<div class="ev">${avatar(a.quien, 'sm')}<div class="txt"><b>${esc(nombre(a.quien) || '¿?')}</b> ${textoActividad(a)}</div><span class="when" title="${esc(fmtFechaHora(a.fecha))}">${esc(relTiempo(a.fecha))}</span></div>`;
  }
  function itemTarea(t) {
    return `<div class="item-t${t.estado === 'hecha' ? ' hecha' : ''}"><button class="check${t.estado === 'hecha' ? ' on' : ''}" type="button" data-act="hecha" data-id="${esc(t.id)}" aria-label="${t.estado === 'hecha' ? 'Reabrir' : 'Marcar hecha'}">✓</button><div><button class="tit" type="button" data-act="open-tarea" data-id="${esc(t.id)}">${esc(t.titulo)}</button><div class="tags">${t.responsable === 'todos' ? '<span class="pill soft">los tres</span>' : ''}${pillEstado(t)}${pillVence(t)}${t.fase !== 'general' ? `<span class="tag">${esc(FASES[t.fase] || t.fase)}</span>` : ''}</div></div></div>`;
  }

  /* ---- hoy: el centro de trabajo ---- */
  function viewHoy() {
    const it = S.estado.iteracion; const me = yo();
    const idx = PHASES.findIndex((p) => p[0] === it.fase); const sem = semanaDe(it.inicio); const dDemo = diasHasta(it.demo);
    const SEM = semanasDe(it); const pct = sem == null ? 0 : Math.min(100, Math.round((sem / SEM) * 100));
    const mias = S.estado.tareas.filter((t) => esMia(t) && t.estado !== 'hecha').sort(ordenTareas);
    const hechasHoy = S.estado.tareas.filter((t) => esMia(t) && t.estado === 'hecha' && diaDe(t.actualizado) === hoy()).length;
    let h = '<div class="panel">';
    h += `<section class="hero"><div class="top-line"><h2>Iteración ${esc(it.numero || 1)} · <span class="fase">${esc(FASES[it.fase] || it.fase)}</span></h2><div class="facts">`
      + `<span>${sem != null ? `semana <b>${sem}</b> de ${SEM}` : '<b>sin fecha de inicio</b>'}</span>`
      + `<span>${dDemo == null ? 'demo <b>sin fecha</b>' : dDemo < 0 ? `demo hace <b>${-dDemo} d</b>` : dDemo === 0 ? 'demo <b>hoy</b>' : `demo en <b>${dDemo} d</b> (${fmtDia(it.demo)})`}</span>`
      + `<span>sincronía <b>${esc(it.sincronia || 'por definir')}</b></span><span>canal <b>${esc(it.canal || 'por definir')}</b></span></div></div>`
      + `<div class="bar"><i style="width:${pct}%"></i></div>`
      + `<div class="mini-steps">${PHASES.map((p, i) => `<button type="button" data-act="ir" data-tab="iter" class="${i < idx ? 'done' : ''}${i === idx ? 'now' : ''}" title="Ir a Iteración">${p[1]}</button>`).join('')}</div></section>`;
    h += '<div class="grid-hoy">';
    h += `<section class="box"><h2>Lo mío <span class="n">${mias.length} abierta${mias.length === 1 ? '' : 's'}${hechasHoy ? ` · ${hechasHoy} hecha${hechasHoy === 1 ? '' : 's'} hoy` : ''}</span></h2>`
      + '<form class="quick" data-act="add-mia"><input class="in" id="mia-new" data-keep="mia-new" placeholder="Algo que tienes que hacer" maxlength="160" autocomplete="off" required><input class="in" type="date" id="mia-vence" aria-label="Vence"><button class="btn primary" type="submit">Agregar</button></form>'
      + `<div class="lista">${mias.length ? mias.map(itemTarea).join('') : '<div class="hint">Nada pendiente a tu nombre ni de los tres. Agrega arriba o toma algo del tablero de Tareas.</div>'}</div>`
      + '<button class="btn quiet sm more" type="button" data-act="ir" data-tab="tareas">Ver el tablero de tareas</button></section>';
    h += bloqueProspectosHoy();
    const otros = Object.keys(P()).filter((p) => p !== me);
    const otrosEnLinea = otros.filter((p) => S.enLinea.includes(p)).length;
    h += `<section class="box"><h2>El equipo <span class="n">${otrosEnLinea === 0 ? 'nadie más en línea' : `${otrosEnLinea} en línea`}</span></h2><div>${otros.map((p) => {
      const suyas = S.estado.tareas.filter((t) => t.responsable === p && t.estado !== 'hecha').sort(ordenTareas);
      const lista = [...suyas.filter((t) => t.estado === 'en_curso'), ...suyas.filter((t) => t.estado === 'bloqueada'), ...suyas.filter((t) => t.estado === 'pendiente')].slice(0, 4);
      return `<div class="persona-row">${avatar(p, S.enLinea.includes(p) ? '' : 'off')}<div><div class="nom">${esc(nombre(p))}<span class="tag">${esc(P()[p].rol)}</span>${S.enLinea.includes(p) ? '<span class="pill ok">en línea</span>' : ''}</div>`
        + (lista.length ? `<ul>${lista.map((t) => `<li><button class="tit lnk" type="button" data-act="open-tarea" data-id="${esc(t.id)}">${esc(t.titulo)}</button> ${pillEstado(t)}${pillVence(t)}</li>`).join('')}${suyas.length > 4 ? `<li class="tag">y ${suyas.length - 4} más</li>` : ''}</ul>` : '<div class="hint">sin tareas abiertas</div>') + '</div></div>';
    }).join('')}</div></section>`;
    const artFase = ARTEF.filter((a) => a[2] === it.fase);
    const cand = S.estado.ideas.filter((i) => i.etapa === 'candidata').length; const eleg = S.estado.ideas.filter((i) => i.etapa === 'elegida').length;
    const bloqueadas = S.estado.tareas.filter((t) => t.estado === 'bloqueada');
    h += `<section class="box"><h2>Pendiente de la fase <span class="n">${esc(FASES[it.fase] || it.fase)}</span></h2><div class="lista">`
      + (artFase.length ? artFase.map((a) => { const x = (it.artefactos || {})[a[0]] || {}; return `<div class="item-t${x.hecho ? ' hecha' : ''}"><span class="check${x.hecho ? ' on' : ''}" aria-hidden="true">✓</span><div><button class="tit" type="button" data-act="ir" data-tab="iter">${esc(a[1])}</button><div class="tags">${x.hecho ? '<span class="pill ok">hecho</span>' : '<span class="tag">artefacto de la fase</span>'}${ligaSegura(x.liga) ? `<a href="${esc(x.liga)}" target="_blank" rel="noopener">abrir</a>` : ''}</div></div></div>`; }).join('') : '<div class="hint">Esta fase no tiene artefacto propio.</div>')
      + `<div class="item-t"><span class="check${eleg ? ' on' : ''}" aria-hidden="true">✓</span><div><button class="tit" type="button" data-act="ir" data-tab="ideas">Oportunidades: ${cand} candidata${cand === 1 ? '' : 's'}, ${eleg} elegida${eleg === 1 ? '' : 's'}</button><div class="tags"><span class="tag">${S.estado.ideas.length} en total</span></div></div></div>`
      + (bloqueadas.length ? `<div class="item-t"><span class="check alert" aria-hidden="true">!</span><div><button class="tit" type="button" data-act="ir" data-tab="tareas">${bloqueadas.length} tarea${bloqueadas.length === 1 ? '' : 's'} bloqueada${bloqueadas.length === 1 ? '' : 's'}</button><div class="tags">${bloqueadas.slice(0, 3).map((t) => `<span class="pill bad">${esc(t.titulo)}</span>`).join('')}</div></div></div>` : '')
      + '</div></section>';
    const acts = (S.estado.actividad || []).slice(0, 8);
    h += `<section class="box"><h2>Últimos movimientos</h2><div class="feed compact">${acts.length ? acts.map(itemActividad).join('') : '<div class="hint">Aún no pasa nada. Lo que hagan los tres queda aquí.</div>'}</div><button class="btn quiet sm more" type="button" data-act="ir" data-tab="actividad">Ver toda la actividad</button></section>`;
    h += '</div></div>';
    return h;
  }

  /* ---- tareas: tablero por estado ---- */
  function viewTareas() {
    const me = yo(); const it = S.estado.iteracion;
    let h = '<div class="panel">';
    h += '<form class="addform tareas" data-act="add-tarea">'
      + '<input class="in t" id="tarea-new" data-keep="tarea-new" placeholder="Nueva tarea" maxlength="160" autocomplete="off" required>'
      + `<select class="in" id="tarea-resp" aria-label="Responsable">${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${k === me ? ' selected' : ''}>${n}</option>`).join('')}</select>`
      + `<select class="in" id="tarea-fase" aria-label="Fase">${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${it.fase === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`
      + '<input class="in" type="date" id="tarea-vence" aria-label="Vence">'
      + '<button class="btn primary" type="submit">Agregar</button></form>';
    h += `<div class="toolbar"><div class="chips"><button class="chip" data-act="fresp" data-v="todas" aria-pressed="${S.fResp === 'todas'}">Todas</button><button class="chip" data-act="fresp" data-v="mias" aria-pressed="${S.fResp === 'mias'}">Mías</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="fresp" data-v="${p}" aria-pressed="${S.fResp === p}">${avatar(p)}${esc(nombre(p))}</button>`).join('')}</div>`
      + `<select class="in" id="ffase" data-keep="ffase" aria-label="Fase" style="width:auto"><option value="todas"${S.fFase === 'todas' ? ' selected' : ''}>Todas las fases</option>${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${S.fFase === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
    let list = S.estado.tareas.slice();
    if (S.fResp === 'mias') list = list.filter(esMia);
    else if (S.fResp !== 'todas') list = list.filter((t) => t.responsable === S.fResp || t.responsable === 'todos');
    if (S.fFase !== 'todas') list = list.filter((t) => t.fase === S.fFase);
    if (!S.estado.tareas.length) h += '<div class="vacio"><b>Sin tareas todavía.</b> Anota lo que alguien tiene que hacer, con responsable y fecha si la hay. Arrastra las tarjetas entre columnas conforme avancen.</div>';
    h += `<div class="stagebar chips">${ESTADOS.map((s) => `<button class="chip" data-act="colt" data-v="${s[0]}" aria-pressed="${S.colT === s[0]}">${s[1]} <span class="tag">${list.filter((t) => t.estado === s[0]).length}</span></button>`).join('')}</div>`;
    h += '<div class="board t4">';
    for (const [k, label] of ESTADOS) {
      let items = list.filter((t) => t.estado === k);
      items = k === 'hecha' ? items.sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || ''))) : items.sort(ordenTareas);
      const total = items.length; const cap = 12;
      if (k === 'hecha' && !S.verHechas && items.length > cap) items = items.slice(0, cap);
      h += `<section class="col${S.colT === k ? ' active' : ''}${items.length ? '' : ' empty'}" data-col="${k}" data-kind="tarea"><h3><span>${label}</span><span class="n">${total}</span></h3><div class="cards">${items.map(cardTarea).join('')}</div>`
        + (k === 'hecha' && total > cap ? `<button class="btn quiet sm" type="button" data-act="verhechas">${S.verHechas ? 'Ver menos' : `Ver las ${total}`}</button>` : '') + '</section>';
    }
    h += '</div></div>';
    return h;
  }
  function cardTarea(t) {
    const idea = t.ideaId ? ideaById(t.ideaId) : null;
    return `<div class="card tarea ${t.estado}" role="button" tabindex="0" draggable="true" data-kind="tarea" data-act="open-tarea" data-id="${esc(t.id)}">`
      + `<button class="check${t.estado === 'hecha' ? ' on' : ''}" type="button" data-act="hecha" data-id="${esc(t.id)}" aria-label="${t.estado === 'hecha' ? 'Reabrir' : 'Marcar hecha'}">✓</button>`
      + `<div class="t">${esc(t.titulo)}</div>`
      + (t.detalle ? `<div class="d">${esc(t.detalle)}</div>` : '')
      + (t.estado === 'bloqueada' && t.motivo ? `<div class="motivo">${esc(t.motivo)}</div>` : '')
      + `<div class="meta">${avatar(t.responsable, 'sm')}<span>${esc(RESP[t.responsable] || '')}</span>${pillVence(t)}${t.fase !== 'general' ? `<span class="tag">${esc(FASES[t.fase] || t.fase)}</span>` : ''}${idea ? `<span class="tag" title="${esc(idea.titulo)}">oportunidad</span>` : ''}${comentariosDe('tarea', t.id).length ? `<span class="tag">${comentariosDe('tarea', t.id).length} coment.</span>` : ''}</div></div>`;
  }
  function renderDlgTarea() {
    const dlg = document.getElementById('dlg'); const t = tareaById(S.openTarea);
    if (!t) { S.openTarea = null; if (dlg.open) dlg.close(); return; }
    const keep = captureFocus(dlg); const B = (f) => `data-bind="tareas:${esc(t.id)}:${f}"`;
    const ideas = S.estado.ideas.slice().sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)));
    let h = '<div class="dlg"><div class="main">';
    h += `<div class="seg">${ESTADOS.map((s) => `<button type="button" data-act="estado-t" data-id="${esc(t.id)}" data-s="${s[0]}" aria-pressed="${t.estado === s[0]}">${s[1]}</button>`).join('')}</div>`;
    h += `<input class="title" ${B('titulo')} value="${esc(t.titulo)}" maxlength="160" aria-label="Título">`;
    h += `<div class="field"><label>Detalle o liga</label><textarea class="in" rows="3" ${B('detalle')} placeholder="Contexto, liga al Doc, lo que haga falta para hacerla">${esc(t.detalle)}</textarea></div>`;
    if (t.estado === 'bloqueada') h += `<div class="field"><label>Bloqueada por</label><input class="in" ${B('motivo')} value="${esc(t.motivo)}" placeholder="Qué falta o quién la destraba"></div>`;
    h += seccionComentarios('tarea', t.id);
    h += '</div><div class="side">';
    h += `<div class="field"><label>Responsable</label><select class="in" ${B('responsable')}>${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${t.responsable === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
    h += `<div class="field"><label>Fase</label><select class="in" ${B('fase')}>${Object.entries(FASES).map(([k, n]) => `<option value="${k}"${t.fase === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
    h += `<div class="field"><label>Vence</label><input class="in" type="date" ${B('vence')} value="${esc(t.vence)}"></div>`;
    h += `<div class="field"><label>Oportunidad relacionada</label><select class="in" ${B('ideaId')}><option value="">—</option>${ideas.map((i) => `<option value="${esc(i.id)}"${t.ideaId === i.id ? ' selected' : ''}>${esc(i.titulo)}</option>`).join('')}</select></div>`;
    h += '</div>';
    h += `<div class="foot"><span>creada ${fmtFechaHora(t.creado)}${t.actualizadoPor ? ` · editada por ${esc(nombre(t.actualizadoPor))} ${relTiempo(t.actualizado)}` : ''}</span><span><button class="btn quiet danger sm" type="button" data-act="del-tarea" data-id="${esc(t.id)}">Eliminar</button> <button class="btn sm" type="button" data-act="close">Cerrar</button></span></div>`;
    h += '</div>';
    dlg.innerHTML = h; restoreFocus(dlg, keep);
    if (!dlg.open) dlg.showModal();
  }

  /* ---- prospectos: el embudo comercial del Plan Maestro ---- */
  const prospectoById = (id) => S.estado.prospectos.find((p) => p.id === id);
  const enJuego = (p) => p.etapa !== 'descartado';
  const nSenales = (p) => Object.values(p.senales || {}).filter(Boolean).length;
  const pillSenales = (p) => { const n = nSenales(p); return n ? `<span class="pill ok">${n} señal${n === 1 ? '' : 'es'}</span>` : ''; };
  const ordenProspectos = (a, b) => String(a.fechaSiguiente || '9').localeCompare(String(b.fechaSiguiente || '9')) || String(a.creado || '').localeCompare(String(b.creado || ''));
  const etiquetaEtapaP = (k) => (ETAPAS_P.find((e) => e[0] === k) || [])[1] || k;
  function pillSiguiente(p) {
    if (!p.fechaSiguiente || !enJuego(p)) return p.fechaSiguiente ? `<span class="tag">${fmtDia(p.fechaSiguiente)}</span>` : '';
    const d = diasHasta(p.fechaSiguiente);
    if (d < 0) return `<span class="pill bad">venció ${fmtDia(p.fechaSiguiente)}</span>`;
    if (d === 0) return '<span class="pill warn">hoy</span>';
    if (d === 1) return '<span class="pill warn">mañana</span>';
    return `<span class="tag">${fmtDia(p.fechaSiguiente)}</span>`;
  }
  async function guardarProspecto(p) {
    try { const j = await api('PUT', `/api/prospectos/${encodeURIComponent(p.id)}`, sinSellos(p)); upsert(S.estado.prospectos, j.doc); S.estado.version = j.version; render(); return true; }
    catch (e) { if (e.code !== 'sin_sesion') { toast(e.code === 'empresa_requerida' ? 'Falta el nombre de la empresa.' : mensajeError(e)); await cargarEstado(); } return false; }
  }
  async function borrarProspecto(id) {
    try { const j = await api('DELETE', `/api/prospectos/${encodeURIComponent(id)}`); S.estado.prospectos = S.estado.prospectos.filter((p) => p.id !== id); S.estado.version = j.version; render(); }
    catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } }
  }
  function viewProspectos() {
    let h = '<div class="panel">';
    h += '<form class="addform tareas" data-act="add-prospecto">'
      + '<input class="in t" id="prospecto-new" data-keep="prospecto-new" placeholder="Persona o empresa cercana para probar" maxlength="160" autocomplete="off" required>'
      + `<select class="in" id="prospecto-resp" aria-label="Responsable">${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${k === 'daniel' ? ' selected' : ''}>${n}</option>`).join('')}</select>`
      + `<select class="in" id="prospecto-caso" aria-label="Caso de uso"><option value="">Oportunidad por definir</option>${S.estado.ideas.slice().sort((a, b) => String(a.titulo).localeCompare(String(b.titulo))).map((i) => `<option value="${esc(i.id)}">${esc(i.titulo)}</option>`).join('')}</select>`
      + '<input class="in" type="date" id="prospecto-fecha" aria-label="Siguiente paso, fecha">'
      + '<button class="btn primary" type="submit">Agregar</button></form>';
    h += `<div class="toolbar"><div class="chips"><button class="chip" data-act="frespp" data-v="todas" aria-pressed="${S.fRespP === 'todas'}">Todos</button>${Object.keys(P()).map((p) => `<button class="chip" data-act="frespp" data-v="${p}" aria-pressed="${S.fRespP === p}">${avatar(p)}${esc(nombre(p))}</button>`).join('')}</div><span class="hint">Gente y empresas cercanas con las que validamos sin fricción. Miramos si la prueban sin insistir, la repiten, piden más, la recomiendan o pagarían. Si un usuario pide "su versión", es una señal, no una tarea.</span></div>`;
    let list = S.estado.prospectos.slice();
    if (S.fRespP !== 'todas') list = list.filter((p) => p.responsable === S.fRespP || p.responsable === 'todos');
    if (!S.estado.prospectos.length) h += '<div class="vacio"><b>Todavía no hay usuarios de prueba.</b> Agrega arriba a alguien cercano; después abre la tarjeta para anotar cómo lo conocemos, qué prueba, las señales y el siguiente paso con fecha.</div>';
    h += `<div class="stagebar chips">${ETAPAS_P.map((e) => `<button class="chip" data-act="colp" data-v="${e[0]}" aria-pressed="${S.colP === e[0]}">${e[1]} <span class="tag">${list.filter((p) => p.etapa === e[0]).length}</span></button>`).join('')}</div>`;
    h += '<div class="board">';
    for (const [k, label] of ETAPAS_P) {
      const items = list.filter((p) => p.etapa === k).sort(ordenProspectos);
      h += `<section class="col${S.colP === k ? ' active' : ''}${items.length ? '' : ' empty'}" data-col="${k}" data-kind="prospecto"><h3><span class="${k === 'jala' ? 'hl' : ''}">${label}</span><span class="n">${items.length}</span></h3><div class="cards">${items.map(cardProspecto).join('')}</div></section>`;
    }
    h += '</div></div>';
    return h;
  }
  function cardProspecto(p) {
    const caso = p.casoId ? ideaById(p.casoId) : null; const nc = comentariosDe('prospecto', p.id).length;
    return `<div class="card prospecto" role="button" tabindex="0" draggable="true" data-kind="prospecto" data-act="open-prospecto" data-id="${esc(p.id)}">`
      + `<div class="t">${esc(p.empresa)}</div>`
      + ((p.contacto || p.relacion || p.area) ? `<div class="d">${esc([p.contacto, p.relacion, p.area].filter(Boolean).join(' · '))}</div>` : '')
      + (p.siguientePaso ? `<div class="d"><span class="k">siguiente</span> ${esc(p.siguientePaso)}</div>` : '')
      + `<div class="meta">${avatar(p.responsable, 'sm')}${pillSenales(p)}${pillSiguiente(p)}${caso ? `<span class="tag" title="${esc(caso.titulo)}">${esc(caso.titulo.slice(0, 28))}${caso.titulo.length > 28 ? '…' : ''}</span>` : ''}${nc ? `<span class="tag">${nc} coment.</span>` : ''}</div></div>`;
  }
  function renderDlgProspecto() {
    const dlg = document.getElementById('dlg'); const p = prospectoById(S.openProspecto);
    if (!p) { S.openProspecto = null; if (dlg.open) dlg.close(); return; }
    const keep = captureFocus(dlg); const B = (f) => `data-bind="prospectos:${esc(p.id)}:${f}"`;
    const ideas = S.estado.ideas.slice().sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)));
    let h = '<div class="dlg"><div class="main">';
    h += `<div class="seg wrap"><span class="k">Etapa</span>${ETAPAS_P.map((e) => `<button type="button" data-act="etapa-p" data-id="${esc(p.id)}" data-s="${e[0]}" aria-pressed="${p.etapa === e[0]}">${e[1]}</button>`).join('')}</div>`;
    h += `<input class="title" ${B('empresa')} value="${esc(p.empresa)}" maxlength="160" aria-label="Quién">`;
    h += `<div class="datos"><div class="field"><label>Contacto</label><input class="in" ${B('contacto')} value="${esc(p.contacto)}" placeholder="Nombre y puesto"></div><div class="field"><label>Cómo lo conocemos</label><input class="in" ${B('relacion')} value="${esc(p.relacion)}" placeholder="Cliente de Vitali, amigo, ex colega…"></div><div class="field"><label>Área o proceso</label><input class="in" ${B('area')} value="${esc(p.area)}" placeholder="Ventas, compras, facturación…"></div></div>`;
    h += `<div class="field"><label>Por qué es buen usuario de prueba</label><textarea class="in" rows="2" ${B('razon')} placeholder="Vive el proceso, nos deja probar sin fricción, opina con franqueza">${esc(p.razon)}</textarea></div>`;
    h += `<div class="field"><label>Dolor que vimos</label><textarea class="in" rows="2" ${B('dolor')} placeholder="Tiempo manual, retrabajo, demora, errores">${esc(p.dolor)}</textarea></div>`;
    h += `<div class="field"><label>Qué probó y qué medimos</label><textarea class="in" rows="2" ${B('baseline')} placeholder="Qué versión usó, cuántas veces, cuánto tardaba antes">${esc(p.baseline)}</textarea></div>`;
    h += `<div class="field"><label>Notas</label><textarea class="in" rows="2" ${B('notas')} placeholder="Objeciones, preguntas, lo que dijeron">${esc(p.notas)}</textarea></div>`;
    h += seccionComentarios('prospecto', p.id);
    h += '</div><div class="side">';
    h += `<div class="field"><label>Siguiente paso</label><input class="in" ${B('siguientePaso')} value="${esc(p.siguientePaso)}" placeholder="Llamar, mandar propuesta, agendar demo"></div>`;
    h += `<div class="field"><label>Para cuándo</label><input class="in" type="date" ${B('fechaSiguiente')} value="${esc(p.fechaSiguiente)}"></div>`;
    h += `<div class="field"><label>Responsable</label><select class="in" ${B('responsable')}>${Object.entries(RESP).map(([k, n]) => `<option value="${k}"${p.responsable === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
    h += `<div class="field"><label>Oportunidad</label><select class="in" ${B('casoId')}><option value="">por definir</option>${ideas.map((i) => `<option value="${esc(i.id)}"${p.casoId === i.id ? ' selected' : ''}>${esc(i.titulo)}</option>`).join('')}</select></div>`;
    h += `<div class="field"><label>Señales de que se vende sola</label><div class="senales">${SENALES.map(([k, n]) => `<label><input type="checkbox" ${B(`senales.${k}`)}${(p.senales || {})[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div></div>`;
    h += '</div>';
    h += `<div class="foot"><span>creado ${fmtFechaHora(p.creado)}${p.actualizadoPor ? ` · editado por ${esc(nombre(p.actualizadoPor))} ${relTiempo(p.actualizado)}` : ''}</span><span><button class="btn quiet danger sm" type="button" data-act="del-prospecto" data-id="${esc(p.id)}">Eliminar</button> <button class="btn sm" type="button" data-act="close">Cerrar</button></span></div>`;
    h += '</div>';
    dlg.innerHTML = h; restoreFocus(dlg, keep);
    if (!dlg.open) dlg.showModal();
  }
  function bloqueProspectosHoy() {
    const lista = S.estado.prospectos.filter(enJuego).sort(ordenProspectos);
    return `<section class="box"><h2>Usuarios de prueba <span class="n">${lista.length} en juego</span></h2><div class="lista">${lista.length ? lista.slice(0, 6).map((p) => `<div class="item-t"><span class="av sm ${esc(p.responsable)}" title="${esc(nombre(p.responsable))}">${p.responsable === 'todos' ? '3' : esc(nombre(p.responsable)[0] || '?')}</span><div><button class="tit" type="button" data-act="open-prospecto" data-id="${esc(p.id)}">${esc(p.empresa)}</button><div class="tags"><span class="pill soft">${esc(etiquetaEtapaP(p.etapa))}</span>${pillSenales(p)}${p.siguientePaso ? `<span>${esc(p.siguientePaso)}</span>` : ''}${pillSiguiente(p)}</div></div></div>`).join('') : '<div class="hint">Sin usuarios de prueba. Elige gente cercana con la que puedan validar sin fricción y agrégala en su pestaña.</div>'}</div><button class="btn quiet sm more" type="button" data-act="ir" data-tab="prospectos">Ver usuarios de prueba</button></section>`;
  }

  /* ---- chat y comentarios (un solo modelo: mensaje con o sin referencia) ---- */
  const mensajes = () => (S.estado && S.estado.mensajes) || [];
  const comentariosDe = (tipo, id) => mensajes().filter((m) => m.ref && m.ref.tipo === tipo && m.ref.id === id);
  const noLeidos = () => mensajes().filter((m) => m.quien !== yo() && String(m.fecha) > String(S.leido || '')).length;
  function formatoMensaje(txt) {
    let h = esc(txt);
    h = h.replace(/https?:\/\/[^\s<]+/g, (u) => { const limpio = u.replace(/[),.;!?]+$/, ''); const cola = u.slice(limpio.length); return `<a href="${limpio}" target="_blank" rel="noopener">${limpio}</a>${cola}`; });
    h = h.replace(/(^|[^\w])@(pablo|max|daniel)\b/gi, (m0, pre, p) => `${pre}<span class="mention${p.toLowerCase() === yo() ? ' me' : ''}">@${p}</span>`);
    return h.replace(/\n/g, '<br>');
  }
  function itemMsg(m, enHilo) {
    const mio = m.quien === yo();
    const ref = !enHilo && m.ref ? (m.ref.tipo === 'idea' ? ideaById(m.ref.id) : m.ref.tipo === 'tarea' ? tareaById(m.ref.id) : prospectoById(m.ref.id)) : null;
    const chipRef = !enHilo && m.ref ? (ref ? `<button class="chip sm" type="button" data-act="${m.ref.tipo === 'idea' ? 'open' : m.ref.tipo === 'tarea' ? 'open-tarea' : 'open-prospecto'}" data-id="${esc(m.ref.id)}">${m.ref.tipo === 'idea' ? 'oportunidad' : m.ref.tipo === 'tarea' ? 'tarea' : 'usuario de prueba'}: ${esc(m.ref.titulo)}</button>` : `<span class="tag">${m.ref.tipo}: ${esc(m.ref.titulo)} (ya no existe)</span>`) : '';
    return `<div class="msg${mio ? ' mio' : ''}">${avatar(m.quien, 'sm')}<div class="cuerpo"><div class="hd"><b>${esc(nombre(m.quien) || '¿?')}</b><span class="when" title="${esc(fmtFechaHora(m.fecha))}">${esc(relTiempo(m.fecha))}</span>${chipRef}${mio ? `<button class="lnk" type="button" data-act="del-msg" data-id="${esc(m.id)}" aria-label="Borrar mensaje">borrar</button>` : ''}</div><div class="txt">${formatoMensaje(m.texto)}</div></div></div>`;
  }
  function viewChat() {
    const items = mensajes();
    if (items.length) { const ultimo = items[items.length - 1].fecha; if (String(ultimo) > String(S.leido || '')) { S.leido = ultimo; lsSet('mp.chat.leido', ultimo); } }
    let h = '<div class="panel chat"><div class="chat-log" id="chat-log">';
    if (!items.length) h += '<div class="vacio"><b>Todavía nadie escribe.</b> Este chat es de los tres. Los comentarios que dejen en una tarea, una oportunidad o un usuario de prueba también aparecen aquí, con su referencia.</div>';
    let dia = '';
    for (const m of items) { const d = diaDe(m.fecha); if (d !== dia) { dia = d; h += `<div class="day">${esc(etiquetaDia(d))}</div>`; } h += itemMsg(m, false); }
    h += '</div>';
    h += '<form class="composer" data-act="add-msg"><textarea class="in" id="chat-new" data-keep="chat-new" rows="2" placeholder="Escribe al equipo. Enter envía, Shift+Enter salto de línea. @pablo @max @daniel para mencionar." maxlength="1000"></textarea><button class="btn primary" type="submit">Enviar</button></form>';
    h += '</div>';
    return h;
  }
  function seccionComentarios(tipo, id) {
    const hilo = comentariosDe(tipo, id);
    return `<div class="field comentarios"><label>Comentarios${hilo.length ? ` (${hilo.length})` : ''}</label>`
      + `<div class="hilo">${hilo.length ? hilo.map((m) => itemMsg(m, true)).join('') : '<span class="hint">Sin comentarios. Lo que escribas aquí también sale en el Chat con la referencia.</span>'}</div>`
      + `<form class="composer" data-act="add-msg" data-ref-tipo="${tipo}" data-ref-id="${esc(id)}"><textarea class="in" data-keep="coment-${esc(id)}" rows="2" placeholder="Comentar (Enter envía)" maxlength="1000"></textarea><button class="btn sm primary" type="submit">Comentar</button></form></div>`;
  }
  async function enviarMensaje(form) {
    const ta = form.querySelector('textarea'); const texto = (ta.value || '').trim(); if (!texto) return;
    const ref = form.dataset.refTipo ? { tipo: form.dataset.refTipo, id: form.dataset.refId } : null;
    try {
      const j = await api('POST', '/api/mensajes', ref ? { texto, ref } : { texto });
      S.estado.mensajes.push(j.doc); S.estado.version = j.version;
      if (!ref || S.tab === 'chat') { S.leido = j.doc.fecha; lsSet('mp.chat.leido', j.doc.fecha); }
      ta.value = '';
      render();
    } catch (e) { if (e.code !== 'sin_sesion') { toast(mensajeError(e)); await cargarEstado(); } }
  }
  async function borrarMensaje(id) {
    try { const j = await api('DELETE', `/api/mensajes/${encodeURIComponent(id)}`); S.estado.mensajes = S.estado.mensajes.filter((m) => m.id !== id); S.estado.version = j.version; render(); }
    catch (e) { if (e.code !== 'sin_sesion') { toast(e.code === 'ajeno' ? 'Solo quien escribió el mensaje puede borrarlo.' : mensajeError(e)); await cargarEstado(); } }
  }

  /* ---- iteración ---- */
  function viewIter() {
    const it = S.estado.iteracion; const B = (f) => `data-bind="iter:actual:${f}"`;
    const idx = PHASES.findIndex((p) => p[0] === it.fase); const sem = semanaDe(it.inicio);
    const SEM = semanasDe(it); const pct = sem == null ? 0 : Math.min(100, Math.round((sem / SEM) * 100));
    const dDemo = diasHasta(it.demo);
    let h = '<div class="panel"><div class="grid2">';
    h += `<div class="box"><h2>Iteración ${esc(it.numero || 1)}<small>${FASES[it.fase] || it.fase}${sem != null ? ` · semana ${sem} de ${SEM}` : ' · sin fecha de inicio'}${dDemo != null ? (dDemo < 0 ? ` · la demo fue hace ${-dDemo} d` : dDemo === 0 ? ' · la demo es hoy' : ` · ${dDemo} d para la demo`) : ''}</small></h2>`;
    h += `<div><div class="bar"><i style="width:${pct}%"></i></div><div class="barlbl"><span>${it.inicio ? `inicio ${fmtDia(it.inicio)}` : 'pon la fecha de inicio'}</span><span>${it.demo ? `demo ${fmtDia(it.demo)}` : `${SEM} semanas`}</span></div></div>`;
    h += `<div class="stepper">${PHASES.map((p, i) => `<button type="button" class="step${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}" data-act="fase" data-f="${p[0]}"><span>${p[1]}</span><small>${p[2]}</small></button>`).join('')}</div>`;
    h += '<div class="datos">'
      + `<div class="field"><label>Inicio</label><input class="in" type="date" ${B('inicio')} value="${esc(it.inicio)}"></div>`
      + `<div class="field"><label>Demo al cliente (objetivo)</label><input class="in" type="date" ${B('demo')} value="${esc(it.demo)}"></div>`
      + `<div class="field"><label>Sincronía semanal</label><input class="in" ${B('sincronia')} value="${esc(it.sincronia)}" placeholder="día y hora, 30 min"></div>`
      + `<div class="field"><label>Canal del día a día</label><input class="in" ${B('canal')} value="${esc(it.canal)}" placeholder="WhatsApp, Slack…"></div>`
      + Object.keys(P()).map((k) => `<div class="field"><label>Dedicación · ${esc(P()[k].nombre)}</label><input class="in" ${B(`dedicacion.${k}`)} value="${esc((it.dedicacion || {})[k])}" placeholder="h por semana"></div>`).join('')
      + `<div class="field"><label>Número de iteración</label><input class="in" type="number" min="1" ${B('numero')} value="${esc(it.numero || 1)}"></div>`
      + `<div class="field"><label>Semanas de la iteración (4–8)</label><input class="in" type="number" min="4" max="8" ${B('semanas')} value="${esc(SEM)}"></div>`
      + '</div></div>';
    h += '<div style="display:grid;gap:16px">';
    h += `<div class="box"><h2>Artefactos<small>uno por fase</small></h2><div>${ARTEF.map((a) => { const x = (it.artefactos || {})[a[0]] || {}; return `<div class="art${x.hecho ? ' ok' : ''}"><input type="checkbox" ${B(`artefactos.${a[0]}.hecho`)}${x.hecho ? ' checked' : ''} aria-label="${a[1]}"><span class="name">${a[1]}<span class="tag">${FASES[a[2]]}</span>${ligaSegura(x.liga) ? `<a href="${esc(x.liga)}" target="_blank" rel="noopener">abrir</a>` : ''}</span><input class="in" ${B(`artefactos.${a[0]}.liga`)} value="${esc(x.liga)}" placeholder="liga"></div>`; }).join('')}</div></div>`;
    h += `<div class="box"><h2>Decisiones<small>seguir · ajustar · descartar</small></h2>`
      + `<form data-act="add-dec" style="display:grid;gap:8px"><div class="seg">${TIPOS_DEC.map(([k, n]) => `<button type="button" data-act="tipodec" data-v="${k}" aria-pressed="${S.tipoDec === k}">${n}</button>`).join('')}</div><textarea class="in" id="dec-new" data-keep="dec-new" rows="2" placeholder="Qué decidimos y por qué, en una o dos líneas" required></textarea><div><button class="btn primary sm" type="submit">Registrar decisión</button></div></form>`;
    const decs = (it.decisiones || []).slice().reverse();
    h += `<div class="dec">${decs.length ? decs.map((d) => `<div class="item ${esc(d.tipo || 'otra')}"><span class="k">${fmtFechaHora(d.fecha)}${d.quien ? ` · ${esc(nombre(d.quien))}` : ''} · ${esc(d.tipo || 'otra')}</span>${esc(d.texto)}</div>`).join('') : '<span class="tag">todavía ninguna</span>'}</div></div>`;
    h += `<div class="box"><h2>Provocación</h2><p class="prov">${esc(PROVOCACIONES[S.prov % PROVOCACIONES.length])}</p><div><button class="btn sm" type="button" data-act="prov">Otra</button></div></div>`;
    h += '</div></div></div>';
    return h;
  }

  /* ---- actividad ---- */
  function viewActividad() {
    const items = S.estado.actividad || [];
    if (!items.length) return '<div class="panel"><div class="vacio"><b>Aún no pasa nada.</b> Aquí queda quién creó, movió o decidió qué, para no perder el hilo entre sesiones.</div></div>';
    let h = '<div class="panel"><div class="feed">'; let dia = '';
    for (const a of items) {
      const d = diaDe(a.fecha); if (d !== dia) { dia = d; h += `<div class="day">${esc(etiquetaDia(d))}</div>`; }
      h += itemActividad(a);
    }
    return `${h}</div></div>`;
  }

  /* ---------- acciones ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'tab') { S.tab = el.dataset.tab; lsSet('mp.tab.v2', S.tab); render(); return; }
    if (act === 'stage') { S.stage = el.dataset.s; render(); return; }
    if (act === 'fautor') { S.fAutor = el.dataset.v; render(); return; }
    if (act === 'fresp') { S.fResp = el.dataset.v; lsSet('mp.fresp', S.fResp); render(); return; }
    if (act === 'tipodec') { S.tipoDec = el.dataset.v; render(); return; }
    if (act === 'prov') { S.prov = (S.prov + 1) % PROVOCACIONES.length; render(); return; }
    if (act === 'open') { S.openTarea = null; S.openProspecto = null; S.openIdea = el.dataset.id; renderDlg(); return; }
    if (act === 'open-tarea') { S.openIdea = null; S.openProspecto = null; S.openTarea = el.dataset.id; renderDlgTarea(); return; }
    if (act === 'open-prospecto') { S.openIdea = null; S.openTarea = null; S.openProspecto = el.dataset.id; renderDlgProspecto(); return; }
    if (act === 'frespp') { S.fRespP = el.dataset.v; render(); return; }
    if (act === 'colp') { S.colP = el.dataset.v; render(); return; }
    if (act === 'ir') { S.tab = el.dataset.tab; lsSet('mp.tab.v2', S.tab); render(); return; }
    if (act === 'colt') { S.colT = el.dataset.v; render(); return; }
    if (act === 'ffase') { S.fFase = el.dataset.v; render(); return; }
    if (act === 'verhechas') { S.verHechas = !S.verHechas; render(); return; }
    if (act === 'close') { const d = document.getElementById('dlg'); S.openIdea = null; S.openTarea = null; S.openProspecto = null; if (d.open) d.close(); return; }
    if (!S.estado) return;
    if (act === 'etapa') { const i = ideaById(el.dataset.id); if (i && i.etapa !== el.dataset.s) await guardarIdea({ ...i, etapa: el.dataset.s }); return; }
    if (act === 'etapa-p') { const p = prospectoById(el.dataset.id); if (p && p.etapa !== el.dataset.s) await guardarProspecto({ ...p, etapa: el.dataset.s }); return; }
    if (act === 'del-prospecto') { const p = prospectoById(el.dataset.id); if (!p) return; if (!confirm(`¿Eliminar al usuario de prueba "${p.empresa || ''}"?`)) return; S.openProspecto = null; const d = document.getElementById('dlg'); if (d.open) d.close(); await borrarProspecto(p.id); return; }
    if (act === 'estado-t') { const t = tareaById(el.dataset.id); if (t && t.estado !== el.dataset.s) await guardarTarea({ ...t, estado: el.dataset.s }); return; }
    if (act === 'voto') {
      const i = ideaById(el.dataset.id); if (!i) return; const d = parseInt(el.dataset.d, 10); const me = yo();
      const v = { ...(i.votos || {}) }; const cur = v[me] || 0;
      if (d > 0 && votosUsados(me) >= VOTOS_MAX) { toast(`Ya usaste tus ${VOTOS_MAX} votos`); return; }
      v[me] = Math.max(0, cur + d); await guardarIdea({ ...i, votos: v }); return;
    }
    if (act === 'crit') { const i = ideaById(el.dataset.id); if (!i) return; await guardarIdea({ ...i, criterios: { ...(i.criterios || {}), [el.dataset.k]: parseInt(el.dataset.v, 10) } }); return; }
    if (act === 'reacc') { const i = ideaById(el.dataset.id); if (!i) return; const me = yo(); const r = { ...(i.reacciones || {}) }; r[me] = r[me] === el.dataset.r ? '' : el.dataset.r; await guardarIdea({ ...i, reacciones: r }); return; }
    if (act === 'del-idea') { const i = ideaById(el.dataset.id); if (!i) return; if (!confirm(`¿Eliminar la oportunidad "${i.titulo || ''}"? No se puede deshacer.`)) return; S.openIdea = null; document.getElementById('dlg').close(); await borrarIdea(i.id); return; }
    if (act === 'del-msg') { if (!confirm('¿Borrar tu mensaje?')) return; await borrarMensaje(el.dataset.id); return; }
    if (act === 'del-tarea') { const t = tareaById(el.dataset.id); if (!t) return; if (!confirm(`¿Eliminar la tarea "${t.titulo || ''}"?`)) return; S.openTarea = null; const d = document.getElementById('dlg'); if (d.open) d.close(); await borrarTarea(t.id); return; }
    if (act === 'hecha') { const t = tareaById(el.dataset.id); if (!t) return; await guardarTarea({ ...t, estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' }); return; }
    if (act === 'fase') { const it = S.estado.iteracion; if (it.fase !== el.dataset.f) await guardarIteracion({ ...it, fase: el.dataset.f }); return; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName === 'TEXTAREA' && e.target.closest && e.target.closest('form[data-act="add-msg"]')) { e.preventDefault(); const f = e.target.closest('form'); if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); return; }
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.card[data-act]')) { e.preventDefault(); e.target.closest('.card').click(); return; }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && S.tab === 'ideas' && S.estado && !S.openIdea) {
      const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
      const inp = document.getElementById('idea-new'); if (inp) { e.preventDefault(); inp.focus(); }
    }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-act]'); if (!f) return; e.preventDefault();
    if (f.dataset.act === 'entrar') {
      const v = (document.getElementById('liga').value || '').trim();
      const m = /\/entrar\/([A-Za-z0-9_-]{16,})/.exec(v) || (/^[A-Za-z0-9_-]{16,}$/.test(v) ? [null, v] : null);
      if (!m) { S.errEntrada = 'Eso no parece una liga del tablero. Debe terminar en /entrar/… seguido de tu clave.'; render(); return; }
      window.location.href = `/entrar/${m[1]}`; return;
    }
    if (!S.estado) return;
    if (f.dataset.act === 'add-idea') {
      const inp = document.getElementById('idea-new'); const t = inp.value.trim(); if (!t) return;
      const ok = await guardarIdea({ id: uid(), titulo: t, dolor: '', quien: '', agente: '', validacion: '', notas: '', autor: yo(), etapa: 'semilla', votos: {}, criterios: {}, reacciones: {} });
      if (ok) { S.stage = 'semilla'; const i2 = document.getElementById('idea-new'); if (i2) i2.value = ''; render(); toast('Oportunidad agregada en Detectada'); }
      return;
    }
    if (f.dataset.act === 'add-tarea') {
      const inp = document.getElementById('tarea-new'); const t = inp.value.trim(); if (!t) return;
      const ok = await guardarTarea({ id: uid(), titulo: t, detalle: '', motivo: '', responsable: document.getElementById('tarea-resp').value, fase: document.getElementById('tarea-fase').value, estado: 'pendiente', vence: document.getElementById('tarea-vence').value || '', ideaId: '' });
      if (ok) { const i2 = document.getElementById('tarea-new'); if (i2) i2.value = ''; const v2 = document.getElementById('tarea-vence'); if (v2) v2.value = ''; render(); }
      return;
    }
    if (f.dataset.act === 'add-mia') {
      const inp = document.getElementById('mia-new'); const t = inp.value.trim(); if (!t) return;
      const ok = await guardarTarea({ id: uid(), titulo: t, detalle: '', motivo: '', responsable: yo(), fase: S.estado.iteracion.fase, estado: 'pendiente', vence: document.getElementById('mia-vence').value || '', ideaId: '' });
      if (ok) { const i2 = document.getElementById('mia-new'); if (i2) i2.value = ''; render(); toast('Tarea agregada a lo tuyo'); }
      return;
    }
    if (f.dataset.act === 'add-msg') { await enviarMensaje(f); return; }
    if (f.dataset.act === 'add-prospecto') {
      const inp = document.getElementById('prospecto-new'); const e = inp.value.trim(); if (!e) return;
      const ok = await guardarProspecto({ id: uid(), empresa: e, contacto: '', area: '', casoId: document.getElementById('prospecto-caso').value || '', relacion: '', razon: '', dolor: '', baseline: '', siguientePaso: '', fechaSiguiente: document.getElementById('prospecto-fecha').value || '', responsable: document.getElementById('prospecto-resp').value, notas: '', senales: {}, etapa: 'candidato' });
      if (ok) { const i2 = document.getElementById('prospecto-new'); if (i2) i2.value = ''; S.colP = 'candidato'; render(); toast('Usuario de prueba agregado como candidato'); }
      return;
    }
    if (f.dataset.act === 'add-dec') {
      const ta = document.getElementById('dec-new'); const txt = ta.value.trim(); if (!txt) return;
      const it = S.estado.iteracion;
      const ok = await guardarIteracion({ ...it, decisiones: [...(it.decisiones || []), { fecha: new Date().toISOString(), quien: yo(), tipo: S.tipoDec, texto: txt }] });
      if (ok) { const t2 = document.getElementById('dec-new'); if (t2) t2.value = ''; render(); }
    }
  });
  /* campos enlazados: selects/checkbox/date al cambiar; texto con pausa */
  function setPath(o, path, v) { const ks = path.split('.'); let cur = o; for (let i = 0; i < ks.length - 1; i++) { if (typeof cur[ks[i]] !== 'object' || cur[ks[i]] === null) cur[ks[i]] = {}; cur = cur[ks[i]]; } cur[ks[ks.length - 1]] = v; }
  function applyBind(el, inmediato) {
    if (!S.estado) return;
    const [col, id, campo] = el.dataset.bind.split(':'); if (!col) return;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') val = parseInt(val, 10) || (campo === 'semanas' ? 6 : 1);
    const run = async () => {
      if (col === 'ideas') { const i = ideaById(id); if (!i || i[campo] === val) return; await guardarIdea({ ...i, [campo]: val }); }
      else if (col === 'tareas') { const t = tareaById(id); if (!t || t[campo] === val) return; await guardarTarea({ ...t, [campo]: val }); }
      else if (col === 'prospectos') { const p = prospectoById(id); if (!p) return; const clon = JSON.parse(JSON.stringify(p)); if (campo.includes('.')) setPath(clon, campo, val); else { if (p[campo] === val) return; clon[campo] = val; } await guardarProspecto(clon); }
      else if (col === 'iter') { const it = JSON.parse(JSON.stringify(S.estado.iteracion)); setPath(it, campo, val); await guardarIteracion(it); }
    };
    clearTimeout(timers[el.dataset.bind]);
    if (inmediato) run(); else timers[el.dataset.bind] = setTimeout(run, 600);
  }
  document.addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset) return;
    if (el.dataset.keep === 'q') { S.q = el.value; clearTimeout(timers.q); timers.q = setTimeout(render, 150); return; }
    if (!el.dataset.bind || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') return;
    applyBind(el, false);
  });
  document.addEventListener('change', (e) => { const el = e.target; if (el.id === 'ffase') { S.fFase = el.value; render(); return; } if (!el.dataset || !el.dataset.bind) return; applyBind(el, true); });
  document.getElementById('dlg').addEventListener('close', () => { S.openIdea = null; S.openTarea = null; S.openProspecto = null; });

  /* arrastrar tarjetas entre etapas (escritorio) */
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.card[draggable]'); if (!c) return; S.arrastrando = c.dataset.id; S.arrastrandoKind = c.dataset.kind || 'idea'; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* no aplica */ } });
  document.addEventListener('dragend', () => { S.arrastrando = null; document.querySelectorAll('.card.drag').forEach((c) => c.classList.remove('drag')); document.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col || !S.arrastrando || col.dataset.kind !== S.arrastrandoKind) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch { /* no aplica */ } document.querySelectorAll('.col.over').forEach((c) => { if (c !== col) c.classList.remove('over'); }); col.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { const col = e.target.closest && e.target.closest('.col[data-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col || !S.arrastrando) return; e.preventDefault();
    const id = S.arrastrando; const destino = col.dataset.col; S.arrastrando = null; col.classList.remove('over');
    if (col.dataset.kind === 'prospecto') { const p = prospectoById(id); if (p && p.etapa !== destino) { const ok = await guardarProspecto({ ...p, etapa: destino }); if (ok) toast(`«${p.empresa}» → ${etiquetaEtapaP(destino)}`); } return; }
    if (col.dataset.kind === 'tarea') { const t = tareaById(id); if (t && t.estado !== destino) { const ok = await guardarTarea({ ...t, estado: destino }); if (ok) toast(`«${t.titulo}» → ${(ESTADOS.find((s) => s[0] === destino) || [])[1]}`); } return; }
    const i = ideaById(id); if (i && i.etapa !== destino) { const ok = await guardarIdea({ ...i, etapa: destino }); if (ok) toast(`«${i.titulo}» → ${(STAGES.find((s) => s[0] === destino) || [])[1]}`); }
  });

  /* ---------- arranque ---------- */
  cargarEstado().then(() => { if (!S.sinSesion) conectarSSE(); });
})();
