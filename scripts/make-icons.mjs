// Sinh icon PWA đơn giản (nền accent #D9431E, chữ "FT"): node scripts/make-icons.mjs
import sharp from 'sharp';

const svg = (size, safe) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#D9431E"/>
<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(size * safe)}" fill="#fff">FT</text></svg>`;

// maskable: chữ nằm trong vùng an toàn 80% ở giữa
for (const [file, size, safe] of [['icon-192.png', 192, 0.42], ['icon-512.png', 512, 0.42], ['icon-maskable-512.png', 512, 0.32]]) {
  await sharp(Buffer.from(svg(size, safe))).png().toFile(`public/icons/${file}`);
}
