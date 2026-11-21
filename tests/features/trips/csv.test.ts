import { describe, expect, test } from 'vitest';
import { decodeCsv, parseCsv } from '@/features/trips/import/csv';

describe('parseCsv', () => {
  test('bỏ BOM, dấu phẩy, cả CRLF', () => {
    expect(parseCsv('﻿a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('tự nhận dấu chấm phẩy (Excel bản Việt) và ô có ngoặc kép', () => {
    expect(parseCsv('a;b\n"x;y";"say ""hi"""')).toEqual([
      ['a', 'b'],
      ['x;y', 'say "hi"'],
    ]);
  });

  test('ô có xuống dòng trong ngoặc kép giữ nguyên, dòng cuối trống bị bỏ', () => {
    expect(parseCsv('a,b\n"dòng 1\ndòng 2",c\n')).toEqual([
      ['a', 'b'],
      ['dòng 1\ndòng 2', 'c'],
    ]);
  });
});

describe('decodeCsv', () => {
  test('UTF-8 (có hoặc không BOM) giữ nguyên', () => {
    expect(decodeCsv(new TextEncoder().encode('Tên quán;Loại').buffer)).toBe('Tên quán;Loại');
  });
  test('CSV ANSI của Excel bản Việt (windows-1258) vẫn đọc đúng dấu', () => {
    // "Tên quán" trong windows-1258: ê = 0xEA, á = 0xE1
    const bytes = Uint8Array.from([0x54, 0xea, 0x6e, 0x20, 0x71, 0x75, 0xe1, 0x6e]);
    expect(decodeCsv(bytes.buffer)).toBe('Tên quán');
  });
});
