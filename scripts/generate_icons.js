const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const iconsDir = path.resolve(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// 1. High-fidelity Modern SVG Icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>

    <!-- Border Ring Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>

    <!-- Arrow & Zip Gradient -->
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>

    <!-- Tray Glow -->
    <linearGradient id="trayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>

    <!-- Soft Ambient Glow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Modern Squircle Base -->
  <rect x="24" y="24" width="464" height="464" rx="116" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="10" />

  <!-- Subtle Radial Glow Behind Core Emblem -->
  <circle cx="256" cy="256" r="150" fill="#6366f1" fill-opacity="0.12" filter="url(#glow)" />

  <!-- Outlined Geometric Media Frame -->
  <rect x="110" y="110" width="292" height="230" rx="28" fill="none" stroke="#334155" stroke-width="6" stroke-dasharray="12 8" opacity="0.45" />

  <!-- Sun / Media Dot in Frame -->
  <circle cx="345" cy="165" r="18" fill="#f43f5e" opacity="0.8" />

  <!-- Downloader Arrow & Zip Archive Motif -->
  <g filter="url(#glow)">
    <!-- Central Arrow Shaft with Rounded Head -->
    <path d="M256 360 L166 270 C160 264 164 254 173 254 H222 V142 C222 135 228 130 235 130 H277 C284 130 290 135 290 142 V254 H339 C348 254 352 264 346 270 Z" fill="url(#arrowGrad)" />

    <!-- Sleek Rounded Archive Tray / ZIP Capsule -->
    <path d="M150 388 H362 C374 388 384 398 384 410 C384 422 374 432 362 432 H150 C138 432 128 422 128 410 C128 398 138 388 150 388 Z" fill="url(#trayGrad)" />

    <!-- Modern ZIP Interlocking Teeth (Stylized White Marks) -->
    <rect x="248" y="156" width="16" height="6" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="248" y="178" width="16" height="6" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="248" y="200" width="16" height="6" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="248" y="222" width="16" height="6" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="248" y="244" width="16" height="6" rx="3" fill="#ffffff" opacity="0.9" />
  </g>

  <!-- Top Glass Sheen -->
  <path d="M50 140 C90 70 170 54 256 54 C342 54 422 70 462 140 C392 100 320 86 256 86 C192 86 120 100 50 140 Z" fill="#ffffff" fill-opacity="0.07" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svg, 'utf8');

// 2. High Quality PNG Generator (16x16, 48x48, 128x128)
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter type none
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      // Squircle distance formula: (x - 0.5)^4 + (y - 0.5)^4 <= r^4
      const dx = Math.abs(nx - 0.5);
      const dy = Math.abs(ny - 0.5);
      const squircleDist = Math.pow(dx, 4) + Math.pow(dy, 4);
      const isInsideBase = squircleDist < 0.045; // ~rounded squircle

      if (isInsideBase) {
        // Border ring highlight
        const isBorder = squircleDist >= 0.038;

        // Tray: bottom rounded bar
        const isTray = (nx >= 0.28 && nx <= 0.72 && ny >= 0.76 && ny <= 0.85);

        // Arrow head
        const isArrowHead = (ny >= 0.52 && ny <= 0.72 && Math.abs(nx - 0.5) <= (0.72 - ny) * 0.95);
        // Arrow shaft
        const isArrowShaft = (nx >= 0.43 && nx <= 0.57 && ny >= 0.24 && ny <= 0.55);

        // ZIP teeth highlights
        const isZipTeeth = (nx >= 0.47 && nx <= 0.53 && (Math.floor(ny * 25) % 2 === 0) && ny >= 0.28 && ny <= 0.48);

        if (isZipTeeth) {
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
        } else if (isArrowHead || isArrowShaft) {
          // Gradient from vibrant cyan to electric violet
          const t = ny;
          const r = Math.round(56 + t * (129 - 56));
          const g = Math.round(189 + t * (140 - 189));
          const b = Math.round(248 + t * (248 - 248));
          rawData[offset++] = r;
          rawData[offset++] = g;
          rawData[offset++] = b;
          rawData[offset++] = 255;
        } else if (isTray) {
          // Vibrant magenta-cyan gradient for archive tray
          rawData[offset++] = 236; // #ec4899
          rawData[offset++] = 72;
          rawData[offset++] = 153;
          rawData[offset++] = 255;
        } else if (isBorder) {
          // Neon border gradient
          const t = (nx + ny) * 0.5;
          rawData[offset++] = Math.round(56 + t * 180);
          rawData[offset++] = Math.round(189 - t * 80);
          rawData[offset++] = 248;
          rawData[offset++] = 255;
        } else {
          // Deep modern slate background (#0f172a -> #1e1b4b)
          const bgShade = Math.round(15 + ny * 20);
          rawData[offset++] = bgShade;
          rawData[offset++] = bgShade + 6;
          rawData[offset++] = bgShade + 25;
          rawData[offset++] = 255;
        }
      } else {
        // Transparent outside squircle
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), makePng(16));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), makePng(48));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), makePng(128));

console.log('Icons generated successfully (SVG + 16, 48, 128 PNGs).');
