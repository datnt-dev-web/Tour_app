import { describe, expect, test } from 'vitest';
import { buildTripIcs, REMINDER_MIN } from '@/features/trips/services/calendar';

const trip = { id: 't1', name: 'Food tour', city: 'Hải Phòng' };
const stop = (id: string, date: string | null, time: string | null, end: string | null, name: string, extra: { address?: string | null; note?: string | null } = {}) => ({
  id, visit_date: date, visit_time: time, visit_end_time: end, note: extra.note ?? null, place: { name, address: extra.address ?? null },
});

describe('buildTripIcs', () => {
  const ics = buildTripIcs(trip, [
    stop('a', '2026-11-23', '08:45:00', '09:30:00', 'Bánh đa cua; Bà Cụ', { address: '179 Cầu Đất', note: 'đi sớm, đông' }),
    stop('b', '2026-11-23', '12:00:00', null, 'Bún cá'),
    stop('c', null, null, null, 'Chưa xếp'),
  ]);

  test('một VEVENT cho mỗi chỗ đã xếp giờ, giờ VN đổi sang UTC', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20261123T014500Z');
    expect(ics).toContain('DTEND:20261123T023000Z');
    // Không có giờ kết thúc: 60 phút.
    expect(ics).toContain('DTSTART:20261123T050000Z');
    expect(ics).toContain('DTEND:20261123T060000Z');
    expect(ics).toContain('UID:a@food-tour');
  });

  test(`nhắc trước ${REMINDER_MIN} phút; tên/ghi chú được escape theo RFC 5545`, () => {
    expect(ics).toContain(`TRIGGER:-PT${REMINDER_MIN}M`);
    expect(ics).toContain('SUMMARY:Bánh đa cua\\; Bà Cụ');
    expect(ics).toContain('LOCATION:179 Cầu Đất\\, Hải Phòng');
    expect(ics).toContain('DESCRIPTION:đi sớm\\, đông');
  });

  test('dùng CRLF, không dòng nào dài quá 75 byte', () => {
    const long = buildTripIcs(trip, [stop('x', '2026-11-23', '08:00:00', null, 'Quán '.repeat(40))]);
    for (const line of long.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
