// Genera íconos PNG de la PWA sin dependencias externas.
// Dibuja un fondo con gradiente + un libro abierto estilizado.
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// ---- CRC32 + PNG encoder ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Dibujo ----
function lerp(a, b, t) { return a + (b - a) * t; }
function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  // colores marca
  const top = [99, 102, 241];   // #6366f1
  const bot = [124, 58, 237];   // #7c3aed
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const inRounded = (x, y) => {
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(lerp(top[0], bot[0], t));
    const g = Math.round(lerp(top[1], bot[1], t));
    const b = Math.round(lerp(top[2], bot[2], t));
    for (let x = 0; x < size; x++) {
      if (inRounded(x, y)) set(x, y, r, g, b, 255);
      else set(x, y, 0, 0, 0, 0);
    }
  }
  // Libro abierto: dos páginas blancas con lomo central.
  const cx = size / 2;
  const bookTop = size * 0.34, bookBot = size * 0.68;
  const half = size * 0.27;
  const white = [255, 255, 255], ink = [99, 102, 241];
  for (let y = Math.floor(bookTop); y < bookBot; y++) {
    // curva de las páginas (más angostas arriba/abajo)
    const ty = (y - bookTop) / (bookBot - bookTop);
    const curve = Math.sin(ty * Math.PI) * size * 0.03;
    const pageW = half - (size * 0.02);
    for (let side = -1; side <= 1; side += 2) {
      const inner = cx + side * (size * 0.012);
      const outer = cx + side * (pageW + size * 0.012) + side * curve;
      const x0 = Math.min(inner, outer), x1 = Math.max(inner, outer);
      for (let x = Math.floor(x0); x < x1; x++) {
        set(x, y, white[0], white[1], white[2], 255);
      }
      // líneas de texto
      const lineSpacing = size * 0.035;
      if (((y - bookTop) % lineSpacing) < size * 0.012 && ty > 0.08 && ty < 0.92) {
        for (let x = Math.floor(x0 + size * 0.02); x < x1 - size * 0.02; x++) {
          set(x, y, ink[0], ink[1], ink[2], 120);
        }
      }
    }
  }
  return buf;
}

for (const size of [192, 512]) {
  const png = encodePng(size, size, draw(size));
  fs.writeFileSync(join(outDir, `icon-${size}.png`), png);
  console.log(`✓ icon-${size}.png`);
}
// apple-touch-icon (180) reutiliza el de 192 para iOS
fs.writeFileSync(join(outDir, 'apple-touch-icon.png'), encodePng(180, 180, draw(180)));
console.log('✓ apple-touch-icon.png');
