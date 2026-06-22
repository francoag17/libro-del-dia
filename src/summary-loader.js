// Siembra los resúmenes pre-generados (data/summaries.json) en el cache de la DB.
// Así la app muestra resúmenes reales sin necesidad de ANTHROPIC_API_KEY.
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getBook, saveSummary } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, '..', 'data', 'summaries.json');

export function loadSummaries() {
  if (!fs.existsSync(PATH)) return 0;
  let list;
  try {
    const raw = JSON.parse(fs.readFileSync(PATH, 'utf8'));
    list = Array.isArray(raw) ? raw : raw.summaries;
  } catch (e) {
    console.error('[summaries] No se pudo leer summaries.json:', e.message);
    return 0;
  }
  if (!Array.isArray(list)) return 0;

  const now = new Date().toISOString();
  let count = 0;
  for (const s of list) {
    if (!s || !s.id || !getBook(s.id)) continue; // solo si el libro existe
    const { id, ...payload } = s;
    saveSummary(id, payload, now);
    count++;
  }
  return count;
}
