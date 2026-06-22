// Job diario: elige el libro del día, genera su resumen y envía la notificación push.
import cron from 'node-cron';
import { getDailyBook } from './recommend.js';
import { broadcast, pushReady } from './push.js';
import { localDay, TZ } from './util.js';

// CRON por defecto: 08:00 todos los días, en la zona horaria de la app.
const SCHEDULE = process.env.DAILY_CRON || '0 8 * * *';

export async function runDailyJob() {
  const day = localDay();
  const daily = await getDailyBook(day);
  if (!daily) {
    console.warn('[daily] No hay libros en el catálogo, no se envía nada.');
    return { ok: false, reason: 'empty_catalog' };
  }

  const { book } = daily;
  console.log(`[daily] Libro del día (${day}): ${book.title} — ${book.author}`);

  if (pushReady()) {
    try {
      const res = await broadcast({
        title: `📖 Libro del día: ${book.title}`,
        body: book.hook || `${book.author} · ${book.category}`,
        url: '/',
        tag: `libro-${day}`,
      });
      console.log(`[daily] Push enviado: ${res.sent}/${res.total} (limpiadas ${res.removed})`);
    } catch (e) {
      console.error('[daily] Error enviando push:', e.message);
    }
  } else {
    console.log('[daily] Push no configurado (faltan VAPID keys), se omite la notificación.');
  }
  return { ok: true, book: book.title };
}

export function startScheduler() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[scheduler] CRON inválido: "${SCHEDULE}", scheduler no iniciado.`);
    return;
  }
  cron.schedule(SCHEDULE, () => {
    runDailyJob().catch(e => console.error('[daily] Falló el job:', e));
  }, { timezone: TZ });
  console.log(`[scheduler] Job diario programado: "${SCHEDULE}" (${TZ})`);
}
