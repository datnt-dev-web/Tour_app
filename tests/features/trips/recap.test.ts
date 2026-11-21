import { describe, expect, test } from 'vitest';
import { buildRecap } from '@/features/trips/services/recap';

const stop = (id: string, placeId: string, status: 'visited' | 'confirmed' | 'wanted', date: string | null = null) => ({
  id, place_id: placeId, status, visit_date: date, visit_time: date ? '09:00:00' : null, place: { name: `Quán ${placeId}`, category: 'food' as const },
});
const review = (placeId: string, verdict: 'up' | 'down', rating: number | null) => ({ place_id: placeId, verdict, rating });

describe('buildRecap', () => {
  const trip = { start_date: '2026-11-23', end_date: '2026-11-24' };
  const stops = [stop('s1', 'a', 'visited', '2026-11-23'), stop('s2', 'b', 'visited', '2026-11-24'), stop('s3', 'c', 'visited', '2026-11-24'), stop('s4', 'd', 'wanted')];

  test('số ngày, số chỗ đã đi, lộ trình theo ngày (chỉ chỗ đã đi)', () => {
    const r = buildRecap(trip, stops, []);
    expect(r.days).toBe(2);
    expect(r.visitedCount).toBe(3);
    expect(r.route.map((d) => [d.date, d.names])).toEqual([
      ['2026-11-23', ['Quán a']],
      ['2026-11-24', ['Quán b', 'Quán c']],
    ]);
  });

  test('top quán: điểm sao trung bình cao nhất, hòa thì nhiều lượt khen hơn; quán bị chê/không có đánh giá đứng sau', () => {
    const r = buildRecap(trip, stops, [review('a', 'up', 4), review('a', 'up', 5), review('b', 'up', 5), review('c', 'down', 2), review('c', 'up', null)]);
    expect(r.top.map((t) => [t.name, t.avgRating])).toEqual([
      ['Quán b', 5],
      ['Quán a', 4.5],
      ['Quán c', 2],
    ]);
  });

  test('không có đánh giá nào thì top rỗng; chuyến không ngày thì 0 ngày', () => {
    const r = buildRecap({ start_date: null, end_date: null }, stops, []);
    expect(r.top).toEqual([]);
    expect(r.days).toBe(0);
  });
});
