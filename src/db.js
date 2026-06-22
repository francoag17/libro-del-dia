// SQLite (better-sqlite3) — almacenamiento local sin configuración.
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    author      TEXT NOT NULL,
    year        INTEGER,
    category    TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    hook        TEXT,
    why         TEXT,
    difficulty  TEXT
  );

  CREATE TABLE IF NOT EXISTS summaries (
    book_id     TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS daily_picks (
    day         TEXT PRIMARY KEY,   -- YYYY-MM-DD
    book_id     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint    TEXT PRIMARY KEY,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
  );
`);

// ---------- Books ----------
export function upsertBook(b) {
  db.prepare(`
    INSERT INTO books (id, title, author, year, category, tags, hook, why, difficulty)
    VALUES (@id, @title, @author, @year, @category, @tags, @hook, @why, @difficulty)
    ON CONFLICT(id) DO UPDATE SET
      title=@title, author=@author, year=@year, category=@category,
      tags=@tags, hook=@hook, why=@why, difficulty=@difficulty
  `).run({ ...b, tags: JSON.stringify(b.tags || []) });
}

export function getBook(id) {
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  return row ? hydrateBook(row) : null;
}

export function allBooks() {
  return db.prepare('SELECT * FROM books').all().map(hydrateBook);
}

export function booksByCategory(categories) {
  if (!categories || !categories.length) return allBooks();
  const placeholders = categories.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM books WHERE category IN (${placeholders})`)
    .all(...categories).map(hydrateBook);
}

export function countBooks() {
  return db.prepare('SELECT COUNT(*) AS n FROM books').get().n;
}

function hydrateBook(row) {
  return { ...row, tags: JSON.parse(row.tags || '[]') };
}

// ---------- Summaries (cache) ----------
export function getSummary(bookId) {
  const row = db.prepare('SELECT payload FROM summaries WHERE book_id = ?').get(bookId);
  return row ? JSON.parse(row.payload) : null;
}

export function saveSummary(bookId, payload, nowIso) {
  db.prepare(`
    INSERT INTO summaries (book_id, payload, created_at) VALUES (?, ?, ?)
    ON CONFLICT(book_id) DO UPDATE SET payload=excluded.payload, created_at=excluded.created_at
  `).run(bookId, JSON.stringify(payload), nowIso);
}

// ---------- Daily picks ----------
export function getPick(day) {
  const row = db.prepare('SELECT book_id FROM daily_picks WHERE day = ?').get(day);
  return row ? row.book_id : null;
}

export function savePick(day, bookId, nowIso) {
  db.prepare(`
    INSERT INTO daily_picks (day, book_id, created_at) VALUES (?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET book_id=excluded.book_id
  `).run(day, bookId, nowIso);
}

export function recentPickIds(limit = 30) {
  return db.prepare('SELECT book_id FROM daily_picks ORDER BY day DESC LIMIT ?')
    .all(limit).map(r => r.book_id);
}

export function pickHistory(limit = 60) {
  return db.prepare('SELECT day, book_id FROM daily_picks ORDER BY day DESC LIMIT ?').all(limit);
}

// ---------- Subscriptions (Web Push) ----------
export function saveSubscription(sub, nowIso) {
  db.prepare(`
    INSERT INTO subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth
  `).run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, nowIso);
}

export function removeSubscription(endpoint) {
  db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(endpoint);
}

export function allSubscriptions() {
  return db.prepare('SELECT * FROM subscriptions').all().map(r => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
}

// ---------- Settings (key/value) ----------
export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, JSON.stringify(value));
}

export default db;
