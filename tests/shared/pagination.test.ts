import { describe, expect, test } from 'vitest';
import { pageCount, pageItems, pageSlice } from '@/shared/pagination';

describe('pageCount', () => {
  test('làm tròn lên, rỗng vẫn là 1 trang', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});

describe('pageItems', () => {
  test('ít trang thì hiện hết', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });
  test('nhiều trang thì lược giữa', () => {
    expect(pageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, 'gap', 12]);
    expect(pageItems(12, 12)).toEqual([1, 'gap', 11, 12]);
  });
  test('lỗ một trang thì hiện số đó', () => {
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
  });
});

describe('pageSlice', () => {
  const items = Array.from({ length: 17 }, (_, i) => i + 1);

  test('cắt đúng trang, trang cuối lẻ', () => {
    expect(pageSlice(items, 1, 8)).toEqual({ page: 1, count: 3, offset: 0, items: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(pageSlice(items, 3, 8)).toEqual({ page: 3, count: 3, offset: 16, items: [17] });
  });

  test('trang vượt quá (vừa xóa bớt) thì lùi về trang cuối; nhỏ hơn 1 thì về trang 1', () => {
    expect(pageSlice(items, 9, 8).page).toBe(3);
    expect(pageSlice(items, 0, 8).page).toBe(1);
  });

  test('danh sách rỗng vẫn là trang 1/1', () => {
    expect(pageSlice([], 4, 8)).toEqual({ page: 1, count: 1, offset: 0, items: [] });
  });
});
