'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const api = (p, opts) => fetch(p, opts).then((r) => r.json());

const ALL_CATEGORIES = ['Liderazgo', 'Ventas', 'Negocios y productividad', 'Desarrollo personal'];
let catalogCache = [];
let activeFilter = 'Todas';

// ---------- Navegación ----------
$$('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
$('#navToggle').addEventListener('click', () => switchView('ajustes'));

function switchView(view) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'catalogo' && !catalogCache.length) loadCatalog();
  if (view === 'historial') loadHistory();
  if (view === 'ajustes') loadSettings();
}

// ---------- HOY ----------
async function loadToday() {
  try {
    const data = await api('/api/today');
    if (data.error) throw new Error(data.error);
    $('#today-loading').classList.add('hidden');
    $('#today-card').classList.remove('hidden');
    $('#today-card').innerHTML = renderFull(data.book, data.summary, data.placeholder, 'Libro de hoy');
  } catch (e) {
    $('#today-loading').textContent = 'No se pudo cargar el libro de hoy. ¿El servidor está corriendo?';
  }
}

function renderFull(book, s, placeholder, kicker = 'Resumen') {
  const tags = (book.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join('');
  const ideas = (s.ideasClave || []).map((i) =>
    `<div class="idea"><h4>${esc(i.titulo)}</h4><p>${esc(i.detalle)}</p></div>`).join('');
  const acciones = (s.aplicacion || []).map((a) => `<li>${esc(a)}</li>`).join('');
  return `
    <div class="kicker">${esc(kicker)}</div>
    <h1 class="book-title">${esc(book.title)}</h1>
    <div class="book-meta">${esc(book.author)}${book.year ? ' · ' + book.year : ''}</div>
    <div class="badges"><span class="badge cat">${esc(book.category)}</span>${tags}</div>
    ${placeholder ? `<div class="block" style="border-color:#7c3aed"><p class="muted">⚠️ Resumen de muestra. Configurá tu <b>ANTHROPIC_API_KEY</b> para generar resúmenes reales con IA.</p></div>` : ''}
    <div class="block"><h3>En una frase</h3><p class="tldr">${esc(s.tldr)}</p></div>
    <div class="block"><h3>Ideas clave</h3>${ideas}</div>
    <div class="block"><h3>Cómo aplicarlo hoy</h3><ul class="actions-list">${acciones}</ul></div>
    ${s.fraseDestacada ? `<div class="block"><h3>Frase destacada</h3><p class="quote">${esc(s.fraseDestacada)}</p></div>` : ''}
    ${s.paraQuien ? `<div class="block"><h3>Para quién es</h3><p class="muted">${esc(s.paraQuien)}</p></div>` : ''}
    <p class="reading-time">⏱️ ${esc(s.tiempoLectura || '5-7 min')} de lectura</p>
  `;
}

// ---------- CATÁLOGO ----------
async function loadCatalog() {
  const data = await api('/api/catalog');
  catalogCache = data.books || [];
  renderFilters();
  renderCatalog();
}

function renderFilters() {
  const cats = ['Todas', ...ALL_CATEGORIES];
  $('#catalog-filters').innerHTML = cats.map((c) =>
    `<span class="chip ${c === activeFilter ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</span>`).join('');
  $$('#catalog-filters .chip').forEach((ch) => ch.addEventListener('click', () => {
    activeFilter = ch.dataset.cat;
    renderFilters(); renderCatalog();
  }));
}

function renderCatalog() {
  const list = activeFilter === 'Todas'
    ? catalogCache : catalogCache.filter((b) => b.category === activeFilter);
  $('#catalog-list').innerHTML = list.map((b) => `
    <div class="mini-card" data-id="${esc(b.id)}">
      <div class="mt">${esc(b.title)}</div>
      <div class="ma">${esc(b.author)}${b.year ? ' · ' + b.year : ''} · ${esc(b.category)}</div>
      <div class="mh">${esc(b.hook || '')}</div>
    </div>`).join('');
  $$('#catalog-list .mini-card').forEach((c) => c.addEventListener('click', () => openBook(c.dataset.id)));
}

// ---------- HISTORIAL ----------
async function loadHistory() {
  const data = await api('/api/history');
  const rows = data.history || [];
  $('#history-list').innerHTML = rows.length ? rows.map((r) => `
    <div class="history-item" data-id="${esc(r.id)}">
      <span class="day">${fmtDay(r.day)}</span>
      <div style="flex:1">
        <div class="ht">${esc(r.title)}</div>
        <div class="ha">${esc(r.author)} · ${esc(r.category)}</div>
      </div>
    </div>`).join('') : '<p class="muted">Todavía no hay historial. Volvé mañana 🙂</p>';
  $$('#history-list .history-item').forEach((c) => c.addEventListener('click', () => openBook(c.dataset.id)));
}

// ---------- Modal de detalle ----------
async function openBook(id) {
  const modal = $('#detail-modal');
  $('#modal-content').innerHTML = '<div class="loading">Generando resumen…</div>';
  modal.classList.remove('hidden');
  try {
    const data = await api('/api/book/' + encodeURIComponent(id));
    if (data.error) throw new Error(data.error);
    $('#modal-content').innerHTML = renderFull(data.book, data.summary, data.placeholder, data.book.category);
  } catch (e) {
    $('#modal-content').innerHTML = '<p class="muted">No se pudo cargar el resumen.</p>';
  }
}
$('#modalClose').addEventListener('click', () => $('#detail-modal').classList.add('hidden'));
$('#detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'detail-modal') $('#detail-modal').classList.add('hidden');
});

// ---------- AJUSTES ----------
async function loadSettings() {
  // Health
  try {
    const h = await api('/api/health');
    $('#healthBox').textContent =
      `Libros en catálogo: ${h.books}\nIA (resúmenes): ${h.ai ? 'activada' : 'desactivada (falta API key)'}\nPush: ${h.push ? 'configurado' : 'no configurado (faltan VAPID keys)'}`;
  } catch (_) {}
  // Preferencias
  const s = await api('/api/settings');
  const sel = new Set(s.categories || ALL_CATEGORIES);
  $('#pref-categories').innerHTML = ALL_CATEGORIES.map((c) =>
    `<span class="chip ${sel.has(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</span>`).join('');
  $$('#pref-categories .chip').forEach((ch) =>
    ch.addEventListener('click', () => ch.classList.toggle('on')));
  // Estado del push
  refreshPushStatus();
}

$('#btnSavePrefs').addEventListener('click', async () => {
  const cats = $$('#pref-categories .chip.on').map((c) => c.dataset.cat);
  const r = await api('/api/settings/categories', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: cats }),
  });
  setStatus('#prefsStatus', '✓ Preferencias guardadas', 'ok');
});

// ---------- Push ----------
async function refreshPushStatus() {
  const btn = $('#btnPush');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setStatus('#pushStatus', 'Este navegador no soporta notificaciones. En iPhone: primero "Agregar a inicio".', 'err');
    btn.disabled = true; return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { btn.textContent = 'Notificaciones activadas ✓'; setStatus('#pushStatus', 'Vas a recibir el libro cada mañana.', 'ok'); }
  else { btn.textContent = 'Activar notificaciones'; }
}

$('#btnPush').addEventListener('click', async () => {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setStatus('#pushStatus', 'Permiso denegado.', 'err'); return; }
    const { key } = await api('/api/vapid-public-key');
    if (!key) { setStatus('#pushStatus', 'El servidor no tiene push configurado (VAPID).', 'err'); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key),
    });
    await api('/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    setStatus('#pushStatus', '✓ Notificaciones activadas. Te llega el libro cada mañana.', 'ok');
    $('#btnPush').textContent = 'Notificaciones activadas ✓';
  } catch (e) {
    setStatus('#pushStatus', 'Error activando notificaciones: ' + e.message, 'err');
  }
});

// ---------- Helpers ----------
function setStatus(sel, msg, cls) {
  const el = $(sel); el.textContent = msg; el.className = 'status ' + (cls || '');
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDay(d) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}`;
}
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ---------- Init ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW error', e));
}
loadToday();
