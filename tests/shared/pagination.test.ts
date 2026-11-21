import { describe, expect, test } from 'vitest';
import { pageCount, pageItems } from '@/shared/pagination';

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
