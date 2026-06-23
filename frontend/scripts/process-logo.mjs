import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../../Dahticket Logo.png');
const outDir = path.resolve(__dirname, '../public');

function isBackground(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return lum > 195 && sat < 0.18;
}

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = Buffer.from(data);
const { width, height, channels } = info;

for (let i = 0; i < width * height; i++) {
  const idx = i * channels;
  const r = pixels[idx];
  const g = pixels[idx + 1];
  const b = pixels[idx + 2];
  if (isBackground(r, g, b)) {
    pixels[idx + 3] = 0;
  }
}

const trimmed = await sharp(pixels, { raw: { width, height, channels } })
  .trim()
  .png()
  .toBuffer();

await sharp(trimmed)
  .resize({ width: 520, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'dahticket-logo.png'));

await sharp(trimmed)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'favicon.png'));

fs.copyFileSync(path.join(outDir, 'favicon.png'), path.join(outDir, 'apple-touch-icon.png'));

console.log('Logo processed with transparent background.');
