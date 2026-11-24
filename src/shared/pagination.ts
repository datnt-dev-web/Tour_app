/** Số trang (ít nhất 1 để luôn có "trang 1" kể cả khi rỗng). */
export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

/**
 * Các ô số trang cần hiện: trang đầu, trang cuối, trang hiện tại ±1, chỗ bị lược thành 'gap'.
 * Ví dụ trang 6/12 → 1 … 5 6 7 … 12. Ít trang thì hiện hết.
 */
export function pageItems(current: number, count: number): (number | 'gap')[] {
  const keep = new Set([1, count, current - 1, current, current + 1].filter((p) => p >= 1 && p <= count));
  // Lỗ chỉ một trang thì hiện luôn số đó thay vì "…" (1 … 3 vô nghĩa hơn 1 2 3).
  for (const p of [...keep]) {
    if (keep.has(p + 2) && !keep.has(p + 1)) keep.add(p + 1);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]));
}

/**
 * Một trang của danh sách đã tải đủ ở client. Trang vượt quá (vd. vừa xóa bớt) thì lùi về trang cuối,
 * để không bao giờ rơi vào trang trống.
 */
export function pageSlice<T>(items: T[], page: number, pageSize: number): { page: number; count: number; offset: number; items: T[] } {
  const count = pageCount(items.length, pageSize);
  const current = Math.min(Math.max(1, page), count);
  const offset = (current - 1) * pageSize;
  return { page: current, count, offset, items: items.slice(offset, offset + pageSize) };
}
