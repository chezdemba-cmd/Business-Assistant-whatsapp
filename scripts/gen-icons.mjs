/**
 * Génère les icônes PWA / stores à partir du branding Djeli (lettre « D » sur
 * fond sombre + pastille accent), sans dépendance : encodeur PNG minimal.
 *
 *   node scripts/gen-icons.mjs
 *
 * Produit : public/icons/{icon-192,icon-512,maskable-512}.png,
 *           public/apple-touch-icon.png, public/icons/icon.svg
 * Pour des assets natifs raffinés : `npx @capacitor/assets generate`.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "public");
mkdirSync(resolve(OUT, "icons"), { recursive: true });

// Palette branding (cf. docs/mockup/DESIGN-TOKENS.md)
const BG = [26, 19, 51];        // #1A1333 fond sombre
const ACCENT = [232, 145, 45];  // #E8912D orange Djeli
const INK = [245, 242, 250];    // presque blanc

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
  };
  draw(set, size);
  // filtre 0 par ligne
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Dessine : fond, un arc accent en bas-droite, et un « D » stylisé.
function drawIcon(pad) {
  return (set, size) => {
    const cx = size / 2, cy = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        set(x, y, BG);
      }
    }
    // pastille accent (arc en bas-droite)
    const rp = size * 0.42;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - size * 0.82, y - size * 0.84);
        if (d < rp) set(x, y, ACCENT, 235);
      }
    }
    // Lettre D : stem vertical + demi-anneau
    const m = size * pad;
    const stemX0 = size * 0.30, stemW = size * 0.11;
    const top = m, bot = size - m;
    for (let y = top; y < bot; y++) {
      for (let x = stemX0; x < stemX0 + stemW; x++) set(x | 0, y | 0, INK);
    }
    const rOut = (bot - top) / 2, rIn = rOut - stemW;
    const arcCx = stemX0 + stemW, arcCy = (top + bot) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x < arcCx) continue;
        const d = Math.hypot(x - arcCx, y - arcCy);
        if (d <= rOut && d >= rIn) set(x, y, INK);
      }
    }
    void cx; void cy;
  };
}

// maskable : plus de marge (zone de sécurité 20%)
writeFileSync(resolve(OUT, "icons/icon-192.png"), png(192, drawIcon(0.14)));
writeFileSync(resolve(OUT, "icons/icon-512.png"), png(512, drawIcon(0.14)));
writeFileSync(resolve(OUT, "icons/maskable-512.png"), png(512, drawIcon(0.22)));
writeFileSync(resolve(OUT, "apple-touch-icon.png"), png(180, drawIcon(0.16)));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#1A1333"/>
<circle cx="420" cy="430" r="215" fill="#E8912D" fill-opacity="0.92"/>
<path d="M154 88 h56 a168 168 0 0 1 0 336 h-56 z M154 88 v336 h44 V88 z" fill="#F5F2FA"/>
</svg>`;
writeFileSync(resolve(OUT, "icons/icon.svg"), svg);

console.log("✓ Icônes générées dans public/icons + public/apple-touch-icon.png");
