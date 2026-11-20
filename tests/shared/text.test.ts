import { describe, expect, test } from 'vitest';
import { normalizeText } from '@/shared/text';

describe('normalizeText', () => {
  test('gộp các cách gõ thành phố', () => {
    for (const s of ['Hải Phòng', 'hai phong', '  HẢI   PHÒNG ']) expect(normalizeText(s)).toBe('hai phong');
    expect(normalizeText('Đà Lạt')).toBe('da lat');
  });
});
