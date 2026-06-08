// Generates icon.png (128x128) — a progress-bar motif matching the extension.
// Pure Node (zlib), no native deps. Run: node scripts/generate-icon.js
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const S = 128;
const buf = Buffer.alloc(S * S * 4); // RGBA

function set(x, y, r, g, b, a) {
  const i = (y * S + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

// rounded-rect membership
function inRoundRect(x, y, x0, y0, x1, y1, rad) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + rad), x1 - rad);
  const cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rad * rad;
}

const BG = [30, 30, 46];
const TRACK = [58, 58, 74];
const FILL = [79, 195, 247];
const FILL2 = [41, 121, 255];

const fillFraction = 0.65;
const barX0 = 22,
  barX1 = 106,
  barY0 = 54,
  barY1 = 74;
const splitX = barX0 + (barX1 - barX0) * fillFraction;

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (inRoundRect(x, y, barX0, barY0, barX1, barY1, 10)) {
      if (x <= splitX) {
        const t = (x - barX0) / (barX1 - barX0);
        const r = Math.round(FILL[0] + (FILL2[0] - FILL[0]) * t);
        const g = Math.round(FILL[1] + (FILL2[1] - FILL[1]) * t);
        const b = Math.round(FILL[2] + (FILL2[2] - FILL[2]) * t);
        set(x, y, r, g, b, 255);
      } else {
        set(x, y, TRACK[0], TRACK[1], TRACK[2], 255);
      }
    } else if (inRoundRect(x, y, 8, 8, S - 8, S - 8, 24)) {
      set(x, y, BG[0], BG[1], BG[2], 255);
    } else {
      set(x, y, 0, 0, 0, 0); // transparent corners
    }
  }
}

// Encode PNG (color type 6, 8-bit), filter 0 per scanline.
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "icon.png");
fs.writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
