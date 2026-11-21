import { describe, expect, test } from 'vitest';
import { isTripOngoing, planToday } from '@/features/trips/services/today';
import { nowHHMMInVietnam } from '@/shared/date';

type S = { id: string; status: 'wanted' | 'confirmed' | 'visited'; visit_time: string | null; visit_end_time: string | null };
const s = (id: string, time: string | null, end: string | null = null, status: S['status'] = 'confirmed'): S => ({
  id, status, visit_time: time ? `${time}:00` : null, visit_end_time: end ? `${end}:00` : null,
});

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('planToday', () => {
  const day = [s('banh', '07:00', '08:00', 'visited'), s('cafe', '08:30', '09:30'), s('nha', '10:00', '11:00'), s('trua', '12:00'), s('chua', null)];

  test('đang trong khung giờ một chỗ → "đang ở" chỗ đó, kế tiếp là chỗ sau', () => {
    const p = planToday(day, '09:00');
    expect(p.current?.stop.id).toBe('cafe');
    expect(p.next?.stop.id).toBe('nha');
    expect(p.next?.minutesUntil).toBe(60);
    expect(ids(p.upcoming)).toEqual(['trua', 'chua']);
    expect(ids(p.done)).toEqual(['banh']);
  });

  test('đã đi chỗ trước, đang giữa hai chỗ → không "đang ở", kế tiếp là chỗ gần nhất phía trước', () => {
    const p = planToday([s('cafe', '08:30', '09:30', 'visited'), s('nha', '10:00', '11:00')], '09:45');
    expect(p.current).toBeNull();
    expect(p.next?.stop.id).toBe('nha');
    expect(p.next?.minutesUntil).toBe(15);
  });

  test('chỗ chưa tới mà đã quá giờ kết thúc vẫn là kế tiếp, kèm số phút trễ (âm)', () => {
    const p = planToday([s('cafe', '08:30', '09:30'), s('nha', '10:00', '11:00')], '09:50');
    expect(p.next?.stop.id).toBe('cafe');
    expect(p.next?.minutesUntil).toBe(-80);
  });

  test('không có giờ kết thúc thì coi như ở 60 phút', () => {
    expect(planToday([s('trua', '12:00')], '12:59').current?.stop.id).toBe('trua');
    expect(planToday([s('trua', '12:00')], '13:00').current).toBeNull();
  });

  test('chỉ còn chỗ chưa xếp giờ → kế tiếp là chỗ đó, không có số phút', () => {
    const p = planToday([s('chua', null)], '10:00');
    expect(p.next?.stop.id).toBe('chua');
    expect(p.next?.minutesUntil).toBeNull();
  });

  test('đi hết rồi → không có kế tiếp', () => {
    const p = planToday([s('banh', '07:00', null, 'visited')], '20:00');
    expect(p.current).toBeNull();
    expect(p.next).toBeNull();
    expect(ids(p.done)).toEqual(['banh']);
  });
});

describe('isTripOngoing / nowHHMMInVietnam', () => {
  test('hôm nay nằm trong ngày đi (tính cả hai đầu)', () => {
    const trip = { start_date: '2026-11-23', end_date: '2026-11-24' };
    expect(isTripOngoing(trip, '2026-11-23')).toBe(true);
    expect(isTripOngoing(trip, '2026-11-24')).toBe(true);
    expect(isTripOngoing(trip, '2026-11-25')).toBe(false);
    expect(isTripOngoing({ start_date: null, end_date: null }, '2026-11-23')).toBe(false);
  });

  test('giờ theo múi Việt Nam', () => {
    expect(nowHHMMInVietnam(new Date('2026-11-23T01:05:00Z'))).toBe('08:05');
  });
});
