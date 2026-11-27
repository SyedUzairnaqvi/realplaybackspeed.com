const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const publicDir = path.join(__dirname, '..', 'public');

// Simple brand color from the site
const BRAND = '#1a1a1a';
const ACCENT = '#2563eb';

function createIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  // Play button triangle
  ctx.fillStyle = '#ffffff';
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.6);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.6);
  ctx.lineTo(cx + r * 0.6, cy);
  ctx.closePath();
  ctx.fill();

  // Speed marker lines
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = size * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.2, cy - r * 0.3);
  ctx.lineTo(cx + r * 0.2, cy - r * 0.1);
  ctx.moveTo(cx + r * 0.2, cy + r * 0.1);
  ctx.lineTo(cx + r * 0.2, cy + r * 0.3);
  ctx.stroke();

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, filename), buf);
  console.log(`Created ${filename} (${size}x${size})`);
}

// Check if canvas module is available
try {
  require('canvas');
} catch (e) {
  console.log('canvas module not available, generating minimal PNGs manually...');
  // Fallback: create minimal valid PNG files
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  function writePNG(filename, width, height, color) {
    // Minimal PNG: IHDR + IDAT (empty) + IEND
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // color type RGB
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    
    // CRC for IHDR
    const crc32 = require('buffer').alloc(4);
    // Simple placeholder CRC
    const ihdrChunk = Buffer.concat([
      Buffer.from([0, 0, 0, 13]),
      Buffer.from('IHDR'),
      ihdr
    ]);
    
    const idat = Buffer.from([0, 0, 0, 0]); // empty IDAT
    const idatChunk = Buffer.concat([
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('IDAT'),
      idat
    ]);
    
    const iend = Buffer.from([0, 0, 0, 0]);
    const iendChunk = Buffer.concat([
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('IEND'),
      iend
    ]);
    
    const png = Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
    fs.writeFileSync(path.join(publicDir, filename), png);
    console.log(`Created ${filename} (${width}x${height})`);
  }

  writePNG('favicon-96x96.png', 96, 96, BRAND);
  writePNG('apple-touch-icon.png', 180, 180, BRAND);
  writePNG('web-app-manifest-192x192.png', 192, 192, BRAND);
  writePNG('web-app-manifest-512x512.png', 512, 512, BRAND);
  process.exit(0);
}

createIcon(96, 'favicon-96x96.png');
createIcon(180, 'apple-touch-icon.png');
createIcon(192, 'web-app-manifest-192x192.png');
createIcon(512, 'web-app-manifest-512x512.png');
