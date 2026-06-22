// Web Push (VAPID) — envío de notificaciones a las PWAs suscriptas.
import webpush from 'web-push';
import { allSubscriptions, removeSubscription } from './db.js';

let configured = false;

export function configurePush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:francog@gmail.com';
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushReady() {
  return configured;
}

export function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Envía una notificación a todas las suscripciones. Limpia las que ya no existen.
export async function broadcast({ title, body, url = '/', tag = 'libro-del-dia' }) {
  if (!configured) throw new Error('PUSH_NOT_CONFIGURED');
  const subs = allSubscriptions();
  const payload = JSON.stringify({ title, body, url, tag });

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, payload))
  );

  let sent = 0, removed = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++;
    } else {
      const code = r.reason?.statusCode;
      if (code === 404 || code === 410) {
        removeSubscription(subs[i].endpoint);
        removed++;
      }
    }
  });
  return { total: subs.length, sent, removed };
}
