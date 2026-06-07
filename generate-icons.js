// generate-icons.js
// Jalankan sekali: node generate-icons.js
// Memerlukan: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.18; // corner radius

  // Background rounded rect
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1d9e75');
  grad.addColorStop(1, '#0f6e56');
  ctx.fillStyle = grad;
  ctx.fill();

  // Melon emoji (text rendering)
  const fontSize = size * 0.52;
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍈', size / 2, size / 2 + size * 0.03);

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Generated: icons/icon-${size}.png`);
}

sizes.forEach(generateIcon);
console.log('\n🎉 Semua ikon PWA berhasil dibuat di folder icons/');
