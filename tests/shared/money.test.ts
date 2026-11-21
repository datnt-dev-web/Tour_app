import { describe, expect, test } from 'vitest';
import { formatVnd, parseMoney, perPerson } from '@/shared/money';

describe('parseMoney', () => {
  test.each([
    ['120000', 120000],
    ['120.000', 120000],
    ['1.062.000', 1062000],
    ['120,000', 120000],
    ['120k', 120000],
    ['25K', 25000],
    ['1tr', 1000000],
    ['1tr2', 1200000],
    ['1.5tr', 1500000],
    ['2 triệu', 2000000],
    ['90 nghìn', 90000],
    ['160.000đ', 160000],
    [' 0 ', 0],
  ])('%s -> %d', (raw, expected) => expect(parseMoney(raw)).toBe(expected));

  test('ô trống là chưa có giá (null)', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
  });

  test.each(['abc', '12.34', '-5000', '1,5', '5 tỷ', '2000000000'])('không hiểu hoặc vượt trần: %s', (raw) =>
    expect(parseMoney(raw)).toBeUndefined());
});

describe('formatVnd / perPerson', () => {
  test('phân cách nghìn kiểu Việt Nam', () => expect(formatVnd(1062000)).toBe('1.062.000'));
  test('chia đều và làm tròn', () => {
    expect(perPerson(1062000, 4)).toBe(265500);
    expect(perPerson(100000, 3)).toBe(33333);
    expect(perPerson(100000, 0)).toBe(100000);
  });
});
