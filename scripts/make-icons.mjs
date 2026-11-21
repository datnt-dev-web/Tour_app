// Sinh icon app từ ảnh gốc assets/main-icon.jpg (bông hồng trên nền đen): node scripts/make-icons.mjs
// Ra: icon PWA (public/icons), apple-icon và favicon theo quy ước file của Next (src/app), emblem màn login.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'assets/main-icon.jpg';
const BACKGROUND = '#000000';

const square = (size) => sharp(SOURCE).resize(size, size, { fit: 'cover' });
// PNG bảng màu: ảnh ít màu (đỏ, đen, trắng) nên giảm ~4 lần dung lượng mà mắt không thấy khác; service worker tải sẵn các icon này.
const PNG = { palette: true, quality: 90, compressionLevel: 9, effort: 10 };

/** Ảnh thu nhỏ còn `scale` cạnh, đặt giữa nền đen: icon maskable phải nằm trong vùng an toàn (hình tròn 80%). */
async function padded(size, scale) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 3, background: BACKGROUND } })
    .composite([{ input: await square(inner).toBuffer(), left: offset, top: offset }])
    .png(PNG);
}

/** ICO chứa sẵn ảnh PNG (trình duyệt hiện đại đều đọc được), khỏi cần thêm thư viện. */
async function writeIco(file, sizes) {
  // Next đọc favicon bằng bộ giải ICO chỉ nhận PNG RGBA: ảnh JPG nguồn không có alpha nên phải thêm.
  const images = await Promise.all(sizes.map((s) => square(s).ensureAlpha().png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(sizes[i] % 256, entry);
    header.writeUInt8(sizes[i] % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(img.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += img.length;
  });
  await writeFile(file, Buffer.concat([header, ...images]));
}

await square(192).png(PNG).toFile('public/icons/icon-192.png');
await square(512).png(PNG).toFile('public/icons/icon-512.png');
await (await padded(512, 0.8)).toFile('public/icons/icon-maskable-512.png');
await square(180).png(PNG).toFile('src/app/apple-icon.png');
await writeIco('src/app/favicon.ico', [16, 32, 48]);
// Màn login: viền ảnh mờ dần vào nền đen để bông hồng hòa vào khung gai.
const EMBLEM = 360;
const fade = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${EMBLEM}" height="${EMBLEM}"><defs><radialGradient id="g"><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50%" cy="50%" r="50%" fill="url(#g)"/></svg>`,
);
await square(EMBLEM).ensureAlpha().composite([{ input: fade, blend: 'dest-in' }]).webp({ quality: 85 }).toFile('public/login/emblem.webp');
