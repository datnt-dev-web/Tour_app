import { describe, expect, test } from 'vitest';
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS } from '@/features/trips/constants';
import { categoryFromLabel, parseImportTable } from '@/features/trips/import/import-rows';
import { AppError } from '@/shared/errors';

const HEADER = [...IMPORT_COLUMNS];
const row = (name: string, category = 'Ăn chính', address = '', link = '', note = '') => [name, category, address, link, note];

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : 'OTHER';
  }
  return undefined;
}

describe('categoryFromLabel', () => {
  test('khớp nhãn app sau khi bỏ dấu, hoa thường, khoảng trắng', () => {
    expect(categoryFromLabel('Cafe')).toBe('cafe');
    expect(categoryFromLabel('cafe')).toBe('cafe');
    expect(categoryFromLabel(' an chinh ')).toBe('food');
    expect(categoryFromLabel('Quà mang về')).toBe('gift');
  });
  test('ngoài danh sách thì null', () => {
    expect(categoryFromLabel('Nhà hàng')).toBeNull();
  });
});

describe('parseImportTable', () => {
  test('dòng hợp lệ, ô rỗng thành null', () => {
    const r = parseImportTable([HEADER, row('Bánh đa cua', 'Ăn chính', '179 Cầu Đất', 'https://maps.app/x', 'đi sáng'), row('Cafe cô Hạnh', 'Cafe')]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { name: 'Bánh đa cua', category: 'food', address: '179 Cầu Đất', mapsUrl: 'https://maps.app/x', note: 'đi sáng' },
      { name: 'Cafe cô Hạnh', category: 'cafe', address: null, mapsUrl: null, note: null },
    ]);
  });

  test('ghép cột theo tiêu đề, không theo vị trí', () => {
    const r = parseImportTable([['loại', 'TÊN QUÁN'], ['Cafe', 'Quán X']]);
    expect(r.rows).toEqual([{ name: 'Quán X', category: 'cafe', address: null, mapsUrl: null, note: null }]);
  });

  test('bỏ dòng trống đầu file và dòng trống giữa chừng, không báo lỗi', () => {
    const r = parseImportTable([[], HEADER, ['', '', ''], row('A')]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  test('lỗi theo số dòng trong file (tiêu đề là dòng 1)', () => {
    const r = parseImportTable([HEADER, row('A'), row('', 'Cafe'), row('B', 'Nhà hàng'), row('C', 'Cafe', '', 'ftp://x')]);
    expect(r.rows.map((x) => x.name)).toEqual(['A']);
    expect(r.errors).toEqual([
      { line: 3, message: 'Thiếu tên quán.' },
      { line: 4, message: 'Loại "Nhà hàng" không có trong app.' },
      { line: 5, message: 'Link bản đồ không hợp lệ.' },
    ]);
  });

  test('link lấy từ hyperlink chỉ ở cột Link bản đồ; tên có hyperlink vẫn giữ chữ', () => {
    const links = [[], ['https://maps.app/ten', null, null, 'https://maps.app/x']];
    const r = parseImportTable([HEADER, row('Quán Y', 'Cafe', '', 'xem bản đồ')], links);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: 'Quán Y', mapsUrl: 'https://maps.app/x' });
  });

  test('thiếu loại báo lỗi riêng', () => {
    expect(parseImportTable([HEADER, row('A', '')]).errors).toEqual([{ line: 2, message: 'Thiếu loại.' }]);
  });

  test('tên quá dài báo lỗi', () => {
    expect(parseImportTable([HEADER, row('x'.repeat(121))]).errors[0].message).toBe('Tên quán quá dài (tối đa 120 ký tự).');
  });

  test('trùng tên trong file (khác dấu/hoa thường) giữ dòng đầu', () => {
    const r = parseImportTable([HEADER, row('Bánh Đa Cua'), row('banh da cua')]);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([{ line: 3, message: 'Trùng tên với dòng 2.' }]);
  });

  test('quá số dòng tối đa thì ném IMPORT_TOO_MANY', () => {
    const table = [HEADER, ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => row(`Q${i}`))];
    expect(codeOf(() => parseImportTable(table))).toBe('IMPORT_TOO_MANY');
  });

  test('thiếu cột Loại hoặc file rỗng thì ném IMPORT_BAD_HEADER', () => {
    expect(codeOf(() => parseImportTable([['Tên quán'], ['A']]))).toBe('IMPORT_BAD_HEADER');
    expect(codeOf(() => parseImportTable([]))).toBe('IMPORT_BAD_HEADER');
  });
});
