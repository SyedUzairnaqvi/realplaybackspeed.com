const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const publicDir = path.join(__dirname, '..', 'public');
const BRAND = '#1a1a1a';

// Create a 32x32 icon canvas
const canvas = createCanvas(32, 32);
const ctx = canvas.getContext('2d');

ctx.fillStyle = BRAND;
ctx.beginPath();
ctx.arc(16, 16, 14, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.moveTo(14, 14);
ctx.lineTo(14, 18);
ctx.lineTo(20, 16);
ctx.closePath();
ctx.fill();

const pngBuf = canvas.toBuffer('image/png');

// Build ICO file
const iconCount = 1;
const entrySize = 16;
const headerSize = 6;
const imageOffset = headerSize + entrySize;

// ICO header
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);      // Reserved
header.writeUInt16LE(1, 2);      // Type = 1 (icon)
header.writeUInt16LE(iconCount, 4); // Count

// Directory entry
const entry = Buffer.alloc(entrySize);
entry.writeUInt8(32, 0);   // Width
entry.writeUInt8(32, 1);   // Height
entry.writeUInt8(0, 2);    // Color count
entry.writeUInt8(0, 3);    // Reserved
entry.writeUInt16LE(1, 4); // Planes
entry.writeUInt16LE(32, 6); // Bit count
entry.writeUInt32LE(pngBuf.length, 8); // Bytes in resource
entry.writeUInt32LE(imageOffset, 12); // Offset

const ico = Buffer.concat([header, entry, pngBuf]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
console.log('Created favicon.ico (32x32)');
