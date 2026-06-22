import './env.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  countBooks, allBooks, getBook, saveSubscription, removeSubscription,
  getSetting, setSetting, pickHistory,
} from './db.js';
import { getDailyBook, ensureSummary } from './recommend.js';
import { configurePush, pushReady, publicKey, broadcast } from './push.js';
import { startScheduler, runDailyJob } from './scheduler.js';
import { loadCatalog } from './catalog-loader.js';
import { loadSummaries } from './summary-loader.js';
import { hasApiKey } from './claude.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// --- Carga inicial del catálogo (si la DB está vacía) ---
if (countBooks() === 0) {
  const n = loadCatalog();
  console.log(`[init] Catálogo cargado: ${n} libros.`);
}
// --- Siembra resúmenes pre-generados al cache ---
const seeded = loadSummaries();
if (seeded) console.log(`[init] Resúmenes pre-generados cargados: ${seeded}.`);
configurePush();

const CATEGORIES = ['Liderazgo', 'Ventas', 'Negocios y productividad', 'Desarrollo personal'];

// ---------- API ----------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    books: countBooks(),
    push: pushReady(),
    ai: hasApiKey(),
  });
});

app.get('/api/today', async (req, res) => {
  try {
    const daily = await getDailyBook();
    if (!daily) return res.status(404).json({ error: 'Catálogo vacío' });
    res.json(daily);
  } catch (e) {
    console.error('[/api/today]', e.message);
    res.status(500).json({ error: 'No se pudo generar el libro del día', detail: e.message });
  }
});

app.get('/api/book/:id', async (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'No existe' });
  try {
    const { summary, placeholder } = await ensureSummary(book);
    res.json({ book, summary, placeholder: Boolean(placeholder) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo generar el resumen', detail: e.message });
  }
});

app.get('/api/catalog', (req, res) => {
  const books = allBooks()
    .map(({ id, title, author, year, category, tags, hook, difficulty }) =>
      ({ id, title, author, year, category, tags, hook, difficulty }))
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json({ categories: CATEGORIES, total: books.length, books });
});

app.get('/api/history', (req, res) => {
  const rows = pickHistory(60).map(r => {
    const b = getBook(r.book_id);
    return b ? { day: r.day, id: b.id, title: b.title, author: b.author, category: b.category } : null;
  }).filter(Boolean);
  res.json({ history: rows });
});

// ---------- Preferencias ----------
app.get('/api/settings', (req, res) => {
  res.json({ categories: getSetting('categories', CATEGORIES) });
});

app.post('/api/settings/categories', (req, res) => {
  const { categories } = req.body || {};
  if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories debe ser un array' });
  const valid = categories.filter(c => CATEGORIES.includes(c));
  setSetting('categories', valid.length ? valid : CATEGORIES);
  res.json({ ok: true, categories: getSetting('categories') });
});

// ---------- Push ----------
app.get('/api/vapid-public-key', (req, res) => {
  const key = publicKey();
  if (!key) return res.status(503).json({ error: 'Push no configurado' });
  res.json({ key });
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint || !sub.keys) return res.status(400).json({ error: 'Suscripción inválida' });
  saveSubscription(sub, new Date().toISOString());
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) removeSubscription(endpoint);
  res.json({ ok: true });
});

app.post('/api/test-push', async (req, res) => {
  if (!pushReady()) return res.status(503).json({ error: 'Push no configurado' });
  try {
    const daily = await getDailyBook();
    const r = await broadcast({
      title: '🔔 Prueba: ' + (daily?.book.title || 'Libro del día'),
      body: daily?.book.hook || 'Notificación de prueba funcionando.',
      url: '/',
    });
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dispara el job diario (elige libro + envía push). Pensado para un cron externo.
// Si CRON_SECRET está definido, exige ?key=SECRET (o header x-cron-key).
// Acepta GET y POST para ser compatible con cualquier servicio de cron.
function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin secreto definido => abierto (dev/uso personal)
  const provided = req.query.key || req.get('x-cron-key');
  return provided === secret;
}

async function runDailyHandler(req, res) {
  if (!cronAuthorized(req)) return res.status(401).json({ error: 'No autorizado' });
  const r = await runDailyJob();
  res.json(r);
}
app.post('/api/run-daily', runDailyHandler);
app.get('/api/run-daily', runDailyHandler);

// ---------- Estáticos (PWA) ----------
app.use(express.static(join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n📚 Libro del día corriendo en http://localhost:${PORT}`);
  console.log(`   Libros: ${countBooks()} · Push: ${pushReady() ? 'ON' : 'OFF'} · IA: ${hasApiKey() ? 'ON' : 'OFF'}\n`);
  startScheduler();
});
