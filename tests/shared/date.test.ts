import { expect, test } from 'vitest';
import { weekdayIndexInVietnam } from '@/shared/date';

test('weekdayIndexInVietnam: thứ Hai = 0, Chủ nhật = 6, theo giờ VN', () => {
  expect(weekdayIndexInVietnam(new Date('2026-11-23T05:00:00Z'))).toBe(0); // thứ Hai
  expect(weekdayIndexInVietnam(new Date('2026-11-29T05:00:00Z'))).toBe(6); // Chủ nhật
  // 20:00 UTC Chủ nhật đã là 03:00 thứ Hai
  expect(weekdayIndexInVietnam(new Date('2026-11-22T20:00:00Z'))).toBe(0);
});
