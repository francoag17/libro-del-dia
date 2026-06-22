// Carga el catálogo de libros desde data/books.json hacia la DB.
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { upsertBook } from './db.js';
import { slugify } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, '..', 'data', 'books.json');

// Semilla mínima por si todavía no se generó el catálogo completo.
const FALLBACK = [
  { title: 'Cómo ganar amigos e influir sobre las personas', author: 'Dale Carnegie', year: 1936, category: 'Ventas', tags: ['relaciones', 'persuasión', 'comunicación'], hook: 'El clásico eterno sobre tratar con personas y ganarte su confianza.', why: 'Principios atemporales de relaciones humanas que sostienen toda venta y liderazgo.', difficulty: 'intro' },
  { title: 'Hábitos atómicos', author: 'James Clear', year: 2018, category: 'Desarrollo personal', tags: ['hábitos', 'productividad', 'mejora continua'], hook: 'Pequeños cambios del 1% que componen resultados enormes.', why: 'El manual práctico definitivo para construir buenos hábitos y romper los malos.', difficulty: 'intro' },
  { title: 'Los 7 hábitos de la gente altamente efectiva', author: 'Stephen Covey', year: 1989, category: 'Liderazgo', tags: ['efectividad', 'liderazgo', 'principios'], hook: 'Un sistema de principios para la efectividad personal y profesional.', why: 'Marco fundacional de efectividad que cambió el management moderno.', difficulty: 'intermedio' },
  { title: 'SPIN Selling', author: 'Neil Rackham', year: 1988, category: 'Ventas', tags: ['ventas consultivas', 'B2B', 'preguntas'], hook: 'La ciencia detrás de las ventas grandes: preguntar mejor para vender más.', why: 'Investigación real sobre qué hace cerrar ventas complejas B2B.', difficulty: 'intermedio' },
  { title: 'De cero a uno', author: 'Peter Thiel', year: 2014, category: 'Negocios y productividad', tags: ['startups', 'innovación', 'estrategia'], hook: 'Crear algo nuevo vale más que competir en lo existente.', why: 'Visión contraintuitiva sobre monopolios, innovación y construir el futuro.', difficulty: 'intermedio' },
];

export function loadCatalog() {
  let books = FALLBACK;
  if (fs.existsSync(CATALOG_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.books;
      if (Array.isArray(list) && list.length) books = list;
    } catch (e) {
      console.error('[catalog] No se pudo leer books.json, uso fallback:', e.message);
    }
  }

  const seen = new Set();
  let count = 0;
  for (const b of books) {
    if (!b.title || !b.author) continue;
    let id = b.id || slugify(`${b.title}-${b.author}`);
    while (seen.has(id)) id = id + '-x';
    seen.add(id);
    upsertBook({
      id,
      title: b.title,
      author: b.author,
      year: b.year || null,
      category: b.category || 'Negocios y productividad',
      tags: b.tags || [],
      hook: b.hook || '',
      why: b.why || '',
      difficulty: b.difficulty || 'intermedio',
    });
    count++;
  }
  return count;
}
