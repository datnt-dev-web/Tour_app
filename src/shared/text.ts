/** Bỏ dấu tiếng Việt, chữ thường, trim, gộp khoảng trắng — dùng để so khớp tên thành phố/quán. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
