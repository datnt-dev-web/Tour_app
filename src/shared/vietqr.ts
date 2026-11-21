/**
 * Mã VietQR (chuẩn EMVCo của NAPAS) để quét chuyển khoản bằng app ngân hàng nào cũng được.
 * Tạo ngay trên máy: số tài khoản không gửi tới dịch vụ ngoài nào.
 */
const NAPAS_GUID = 'A000000727';
const TRANSFER_TO_ACCOUNT = 'QRIBFTTA';
const VND = '704';
/** Nhiều app ngân hàng cắt nội dung QR quá 25 ký tự. */
export const VIETQR_CONTENT_MAX = 25;

const field = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), 4 chữ số hex in hoa: trường 63 của EMVCo. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: bỏ dấu, chỉ chữ số/chữ cái/khoảng trắng, tối đa 25 ký tự (ngân hàng hay từ chối ký tự lạ). */
export function transferContent(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, VIETQR_CONTENT_MAX)
    .trim();
}

export function buildVietQrPayload(input: { bin: string; accountNo: string; amount: number; content: string }): string {
  const beneficiary = field('00', input.bin) + field('01', input.accountNo);
  const merchant = field('00', NAPAS_GUID) + field('01', beneficiary) + field('02', TRANSFER_TO_ACCOUNT);
  const body =
    field('00', '01') +
    field('01', '12') + // 12 = QR động (có số tiền)
    field('38', merchant) +
    field('53', VND) +
    field('54', String(Math.round(input.amount))) +
    field('58', 'VN') +
    field('62', field('08', transferContent(input.content))) +
    '6304';
  return body + crc16(body);
}
