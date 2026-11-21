import { describe, expect, test } from 'vitest';
import { addMinutes, buildTimeline, defaultDay, formatSlot, lastTransport, suggestTime, toHHMM, tripDays } from '@/features/trips/services/timeline';

const at = (id: string, visit_date: string | null, visit_time: string | null, visit_end_time: string | null = null, transport: string | null = null, clash = false) => ({
  id,
  visit_date,
  visit_time,
  visit_end_time,
  transport,
  clash,
});

describe('tripDays', () => {
  test('liệt kê từ ngày đi tới ngày về', () => {
    expect(tripDays({ start_date: '2026-11-30', end_date: '2026-12-02' })).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });
  test('thiếu ngày về hoặc ngày về trước ngày đi thì chỉ một ngày; thiếu ngày đi thì rỗng', () => {
    expect(tripDays({ start_date: '2026-11-23', end_date: null })).toEqual(['2026-11-23']);
    expect(tripDays({ start_date: '2026-11-23', end_date: '2026-11-20' })).toEqual(['2026-11-23']);
    expect(tripDays({ start_date: null, end_date: '2026-11-23' })).toEqual([]);
  });
  test('chặn chuyến dài bất thường', () => {
    expect(tripDays({ start_date: '2026-01-01', end_date: '2026-12-31' })).toHaveLength(31);
  });
});

describe('buildTimeline', () => {
  const days = ['2026-11-23', '2026-11-24'];

  test('A 9h, B 10h, C 9h30 → A, C, B', () => {
    const t = buildTimeline([at('A', '2026-11-23', '09:00:00'), at('B', '2026-11-23', '10:00:00'), at('C', '2026-11-23', '09:30:00')], days);
    expect(t.days[0].stops.map((s) => s.item.id)).toEqual(['A', 'C', 'B']);
  });

  test('chia theo ngày, ngày sớm trước; chưa xếp giờ để riêng', () => {
    const t = buildTimeline([at('X', '2026-11-24', '08:00:00'), at('Y', null, null), at('Z', '2026-11-23', '20:00:00')], days);
    expect(t.days.map((d) => [d.date, d.dayNumber, d.stops.map((s) => s.item.id)])).toEqual([
      ['2026-11-23', 1, ['Z']],
      ['2026-11-24', 2, ['X']],
    ]);
    expect(t.unscheduled.map((i) => i.id)).toEqual(['Y']);
  });

  test('giữ cờ trùng giờ do database tính', () => {
    const t = buildTimeline([at('A', '2026-11-23', '09:00:00', null, null, true), at('B', '2026-11-23', '10:00:00')], days);
    expect(t.days[0].stops.map((s) => s.clash)).toEqual([true, false]);
  });

  test('ngày ngoài chuyến vẫn hiện, không có số ngày', () => {
    expect(buildTimeline([at('A', '2026-12-01', '09:00:00')], days).days[0].dayNumber).toBeNull();
  });
});

describe('suggestTime', () => {
  const items = [at('A', '2026-11-23', '09:00:00'), at('B', '2026-11-23', '11:30:00'), at('C', '2026-11-24', '22:30:00')];
  test('sau chỗ muộn nhất trong ngày 1 tiếng', () => expect(suggestTime(items, '2026-11-23')).toBe('12:30'));
  test('ngày trống thì 08:00', () => expect(suggestTime(items, '2026-11-25')).toBe('08:00'));
  test('không vượt 23:00', () => expect(suggestTime(items, '2026-11-24')).toBe('23:00'));
  test('có giờ kết thúc thì sau đó 15 phút đi đường (08:45–09:30 → 09:45)', () => {
    expect(suggestTime([at('A', '2026-11-23', '08:45:00', '09:30:00')], '2026-11-23')).toBe('09:45');
  });
});

describe('lastTransport / addMinutes / formatSlot', () => {
  test('lấy phương tiện của chỗ muộn nhất đã ghi phương tiện', () => {
    const items = [at('A', '2026-11-23', '06:00:00', null, 'Tàu'), at('B', '2026-11-23', '08:45:00', null, 'Xe máy thuê'), at('C', '2026-11-23', '10:00:00')];
    expect(lastTransport(items)).toBe('Xe máy thuê');
    expect(lastTransport([at('A', null, null)])).toBeNull();
  });
  test('cộng phút, không vượt cuối ngày', () => {
    expect(addMinutes('08:45', 45)).toBe('09:30');
    expect(addMinutes('23:30', 90)).toBe('23:59');
  });
  test('hiển thị khung giờ', () => {
    expect(formatSlot('08:45:00', '09:30:00')).toBe('08:45 - 09:30');
    expect(formatSlot('21:30:00', null)).toBe('21:30');
  });
});

describe('defaultDay / toHHMM', () => {
  test('hôm nay nếu trong chuyến, không thì ngày đầu', () => {
    expect(defaultDay(['2026-11-23', '2026-11-24'], '2026-11-24')).toBe('2026-11-24');
    expect(defaultDay(['2026-11-23', '2026-11-24'], '2026-11-21')).toBe('2026-11-23');
    expect(defaultDay([], '2026-11-21')).toBeNull();
  });
  test('cắt giây', () => expect(toHHMM('09:30:00')).toBe('09:30'));
});
