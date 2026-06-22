// Lógica de selección del libro del día y obtención del resumen (con cache).
import {
  getPick, savePick, recentPickIds, booksByCategory,
  getBook, getSummary, saveSummary, getSetting,
} from './db.js';
import { generateSummary, hasApiKey } from './claude.js';
import { localDay, hashStr } from './util.js';

// Selecciona (o recupera) el libro asignado a un día. Determinístico y estable.
export function pickBookForDay(day = localDay()) {
  const existing = getPick(day);
  if (existing) return getBook(existing);

  const prefs = getSetting('categories', null); // null => todas
  let pool = booksByCategory(prefs);
  if (!pool.length) pool = booksByCategory(null);
  if (!pool.length) return null;

  // Evitar repetir lo recomendado en los últimos ~30 días (ventana fija).
  const recent = new Set(recentPickIds(30));
  let candidates = pool.filter(b => !recent.has(b.id));
  if (!candidates.length) {
    // Pool agotado: al menos no repetir el de ayer.
    const last = recentPickIds(1)[0];
    candidates = pool.filter(b => b.id !== last);
    if (!candidates.length) candidates = pool;
  }

  // Selección determinística por fecha (estable durante todo el día).
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  const idx = hashStr(day) % candidates.length;
  const chosen = candidates[idx];

  savePick(day, chosen.id, new Date().toISOString());
  return chosen;
}

// Devuelve el resumen del libro, generándolo y cacheándolo si hace falta.
export async function ensureSummary(book) {
  const cached = getSummary(book.id);
  if (cached) return { summary: cached, generated: false };

  if (!hasApiKey()) {
    return { summary: placeholderSummary(book), generated: false, placeholder: true };
  }

  const summary = await generateSummary(book);
  saveSummary(book.id, summary, new Date().toISOString());
  return { summary, generated: true };
}

// Paquete completo para la pantalla principal.
export async function getDailyBook(day = localDay()) {
  const book = pickBookForDay(day);
  if (!book) return null;
  const { summary, placeholder } = await ensureSummary(book);
  return { day, book, summary, placeholder: Boolean(placeholder) };
}

function placeholderSummary(book) {
  return {
    tldr: book.why || 'Resumen no disponible todavía. Configurá tu ANTHROPIC_API_KEY para generarlo automáticamente.',
    ideasClave: [
      { titulo: 'Resumen pendiente', detalle: 'Falta la API key de Anthropic para generar el resumen completo de este libro.' },
    ],
    aplicacion: ['Configurá ANTHROPIC_API_KEY en el archivo .env y recargá.'],
    fraseDestacada: book.hook || '',
    paraQuien: book.why || '',
    tiempoLectura: '—',
    placeholder: true,
  };
}
