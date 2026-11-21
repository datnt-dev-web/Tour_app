/** Tiền VND: chỉ số nguyên đồng. Trần để chặn gõ nhầm thừa số 0 (1 tỷ đồng cho một mục là quá vô lý với chuyến đi nhóm). */
export const MAX_AMOUNT = 1_000_000_000;

const UNITS: Record<string, number> = { k: 1_000, ng: 1_000, nghin: 1_000, ngan: 1_000, tr: 1_000_000, trieu: 1_000_000, m: 1_000_000 };

/**
 * Đọc số tiền người dùng gõ: "120000", "120.000", "120,000", "120k", "1tr2" (1.200.000), "1.5tr", "2 triệu".
 * Trả null khi ô trống (chưa có giá); trả undefined khi không hiểu được để giao diện báo sai.
 */
export function parseMoney(raw: string): number | null | undefined {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ|d$|vnd$/g, '')
    .replace(/\s+/g, '');
  if (!s) return null;

  // Có đơn vị: "1tr2", "1.5tr", "120k". Phần sau đơn vị là chữ số tiếp theo của hàng đó (1tr2 = 1,2 triệu).
  const unit = s.match(/^(\d+(?:[.,]\d+)?)(k|nghin|ngan|ng|trieu|tr|m)(\d*)$/);
  let value: number;
  if (unit) {
    const [, num, u, tail] = unit;
    value = Number(`${num.replace(',', '.')}${tail ? (num.includes('.') || num.includes(',') ? tail : `.${tail}`) : ''}`) * UNITS[u];
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(s) || /^\d+$/.test(s)) {
    // Dấu chấm/phẩy theo nhóm 3 chữ số là phân cách hàng nghìn.
    value = Number(s.replace(/[.,]/g, ''));
  } else {
    return undefined;
  }
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= MAX_AMOUNT ? rounded : undefined;
}

const VND = new Intl.NumberFormat('vi-VN');

/** 120000 -> "120.000" (không kèm đơn vị, để ghép "đ" hay "/người" tùy chỗ). */
export const formatVnd = (n: number) => VND.format(Math.round(n));

/** Chia đều, làm tròn tới đồng; dùng cho "chi phí/người". */
export const perPerson = (total: number, people: number) => Math.round(total / Math.max(1, people));
