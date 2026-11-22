import { describe, expect, test } from 'vitest';
import { buildVietQrPayload, crc16 } from '@/shared/vietqr';

/** Đọc lại payload EMVCo (tag 2 số + độ dài 2 số + giá trị) để kiểm từng trường. */
function tlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < s.length; ) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

describe('VietQR', () => {
  test('crc16 CCITT-FALSE đúng vector chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  test('payload chuyển khoản NAPAS: ngân hàng, số tài khoản, số tiền, nội dung không dấu, CRC hợp lệ', () => {
    const p = buildVietQrPayload({ bin: '970436', accountNo: '0123456789', amount: 350000, content: 'FoodTour Sức Vật' });
    const f = tlv(p);
    expect(f['00']).toBe('01');
    expect(f['01']).toBe('12');
    const merchant = tlv(f['38']);
    expect(merchant['00']).toBe('A000000727');
    expect(tlv(merchant['01'])).toEqual({ '00': '970436', '01': '0123456789' });
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(f['53']).toBe('704');
    expect(f['54']).toBe('350000');
    expect(f['58']).toBe('VN');
    expect(tlv(f['62'])['08']).toBe('FoodTour Suc Vat');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  test('nội dung dài bị cắt còn 25 ký tự, bỏ ký tự lạ', () => {
    const p = buildVietQrPayload({ bin: '970436', accountNo: '1', amount: 1000, content: 'FoodTour Nguyễn Văn Anh Đức @#! rất dài' });
    const content = tlv(tlv(p)['62'])['08'];
    expect(content.length).toBeLessThanOrEqual(25);
    expect(content).toMatch(/^[A-Za-z0-9 ]+$/);
  });
});
