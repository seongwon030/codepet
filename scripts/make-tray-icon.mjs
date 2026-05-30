// Generates a simple black template tray icon (a paw-ish dot) as PNG.
// macOS template images are black + alpha; the OS tints them for light/dark menu bars.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function alphaAt(x, y, w, h) {
  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  const rad = (w / 2) * 0.62; // main pad
  const padR = (w / 2) * 0.16; // toe beans
  const aa = (d, r) => (d <= r ? 255 : d <= r + 1 ? Math.round((r + 1 - d) * 255) : 0);
  let a = aa(Math.hypot(x - cx, y - cy + h * 0.08), rad);
  // three toe beans across the top
  for (const tx of [-0.26, 0, 0.26]) {
    a = Math.max(a, aa(Math.hypot(x - (cx + tx * w), y - (cy - h * 0.32)), padR));
  }
  return a;
}

function png(size) {
  const w = size;
  const h = size;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const o = row + 1 + x * 4;
      raw[o] = 0;
      raw[o + 1] = 0;
      raw[o + 2] = 0;
      raw[o + 3] = alphaAt(x, y, w, h);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('assets', { recursive: true });
writeFileSync('assets/trayTemplate.png', png(22));
writeFileSync('assets/trayTemplate@2x.png', png(44));
console.log('tray icons written: assets/trayTemplate.png (+@2x)');
