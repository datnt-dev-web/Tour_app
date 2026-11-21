import { describe, expect, test } from 'vitest';
import type { RawTripStats } from '@/features/trips/repositories/trips-repo';
import { toTripStats } from '@/features/trips/services/trip-stats';

// Số liệu của bảng kế hoạch Hải Phòng: 4 người, tiền ăn có giá 660.000, vé tàu 1.062.000.
const raw: RawTripStats = {
  people: 4,
  placesTotal: 660000,
  expensesTotal: 1062000,
  visitedTotal: 100000,
  priced: 6,
  active: 8,
  visited: 1,
  confirmed: 6,
  wanted: 1,
  byCategory: [
    { category: 'food', total: 160000, count: 1 },
    { category: 'snack', total: 400000, count: 4 },
    { category: 'cafe', total: 100000, count: 1 },
  ],
  byDay: [
    { date: '2026-11-23', total: 500000 },
    { date: '2026-11-24', total: 160000 },
    { date: null, total: 0 },
  ],
};
const DAYS = ['2026-11-23', '2026-11-24'];

describe('toTripStats', () => {
  test('khớp bảng kế hoạch: tổng 1.722.000, mỗi người 430.500', () => {
    expect(toTripStats(raw, DAYS)).toMatchObject({ people: 4, placesTotal: 660000, expensesTotal: 1062000, total: 1722000, perPerson: 430500 });
  });

  test('đã chi = chỗ đã đi + chi phí khác; chưa có giá = còn hiệu lực - có giá', () => {
    const s = toTripStats(raw, DAYS);
    expect(s.spent).toBe(1162000);
    expect([s.priced, s.unpriced]).toEqual([6, 2]);
    expect(s.progress).toEqual({ visited: 1, confirmed: 6, wanted: 1, total: 8 });
  });

  test('gắn số thứ tự ngày theo lịch chuyến; ngày ngoài chuyến và chưa xếp giờ thì không có', () => {
    const s = toTripStats({ ...raw, byDay: [...raw.byDay, { date: '2026-12-01', total: 1 }] }, DAYS);
    expect(s.byDay.map((d) => d.dayNumber)).toEqual([1, 2, null, null]);
  });

  test('chuyến trống', () => {
    const empty: RawTripStats = { ...raw, placesTotal: 0, expensesTotal: 0, visitedTotal: 0, priced: 0, active: 0, visited: 0, confirmed: 0, wanted: 0, byCategory: [], byDay: [] };
    expect(toTripStats(empty, DAYS)).toMatchObject({ total: 0, perPerson: 0, unpriced: 0, byCategory: [], byDay: [] });
  });
});
