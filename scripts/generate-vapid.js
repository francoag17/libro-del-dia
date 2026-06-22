// Genera un par de claves VAPID para Web Push.
// Uso: npm run vapid  → copiá la salida a tu archivo .env
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\nCopiá estas líneas en tu archivo .env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:francog@gmail.com\n`);
