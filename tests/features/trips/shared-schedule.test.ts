import { describe, expect, test } from 'vitest';
import { formatDuration, freeMinutes, groupByDay, isScheduleLive, stayMinutes, stopPhase, type ShareStop } from '@/features/trips/services/shared-schedule';

const stop = (over: Partial<ShareStop> = {}): ShareStop => ({
  id: 's',
  name: 'Bánh bèo cô Mây',
  address: '65 Chu Văn An',
  category: 'snack',
  date: '2026-11-23',
  start: '14:30',
  end: '15:00',
  visited: false,
  directions: null,
  ...over,
});

describe('stopPhase', () => {
  test('theo giờ trong ngày: trước giờ là sắp tới, trong khung là đang diễn ra, qua giờ kết thúc là xong', () => {
    expect(stopPhase(stop(), '2026-11-23', '14:00')).toBe('upcoming');
    expect(stopPhase(stop(), '2026-11-23', '14:40')).toBe('now');
    expect(stopPhase(stop(), '2026-11-23', '15:00')).toBe('done');
  });

  test('ngày đã qua là xong, ngày chưa tới là sắp tới', () => {
    expect(stopPhase(stop(), '2026-11-24', '08:00')).toBe('done');
    expect(stopPhase(stop(), '2026-11-22', '20:00')).toBe('upcoming');
  });

  test('đã đánh dấu đã đi thì xong, kể cả chưa tới giờ', () => {
    expect(stopPhase(stop({ visited: true }), '2026-11-23', '08:00')).toBe('done');
  });

  test('chưa có giờ kết thúc thì coi như ở 60 phút; chưa xếp giờ thì luôn sắp tới', () => {
    expect(stopPhase(stop({ end: null }), '2026-11-23', '15:20')).toBe('now');
    expect(stopPhase(stop({ end: null }), '2026-11-23', '15:30')).toBe('done');
    expect(stopPhase(stop({ date: null, start: null, end: null }), '2026-11-23', '23:00')).toBe('upcoming');
  });
});

describe('thời lượng và khoảng trống', () => {
  test('stayMinutes / freeMinutes', () => {
    expect(stayMinutes(stop())).toBe(30);
    expect(stayMinutes(stop({ start: null, end: null }))).toBe(0);
    expect(freeMinutes(stop(), stop({ start: '15:30' }))).toBe(30);
    expect(freeMinutes(stop(), stop({ start: '14:45' }))).toBe(0);
  });

  test('formatDuration', () => {
    expect(formatDuration(30)).toBe('30 phút');
    expect(formatDuration(60)).toBe('1 tiếng');
    expect(formatDuration(75)).toBe('1 tiếng 15 phút');
  });
});

test('groupByDay giữ thứ tự, chỗ chưa xếp ngày nằm cuối', () => {
  const a = stop({ id: 'a', date: null, start: null, end: null });
  const b = stop({ id: 'b' });
  const c = stop({ id: 'c', date: '2026-11-24' });
  expect(groupByDay([a, b, c]).map((d) => [d.date, d.stops.map((s) => s.id)])).toEqual([
    ['2026-11-23', ['b']],
    ['2026-11-24', ['c']],
    [null, ['a']],
  ]);
});

test('isScheduleLive: chỉ trong các ngày của lịch trình', () => {
  const list = [{ date: '2026-11-23' }, { date: null }, { date: '2026-11-24' }];
  expect(isScheduleLive(list, '2026-11-22')).toBe(false);
  expect(isScheduleLive(list, '2026-11-23')).toBe(true);
  expect(isScheduleLive(list, '2026-11-24')).toBe(true);
  expect(isScheduleLive(list, '2026-11-25')).toBe(false);
  expect(isScheduleLive([{ date: null }], '2026-11-23')).toBe(false);
});
