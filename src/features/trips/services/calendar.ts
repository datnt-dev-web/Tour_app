import { DEFAULT_STAY_MIN } from './today';

/** Lịch điện thoại nhắc trước giờ đến mỗi chỗ ngần này phút. */
export const REMINDER_MIN = 30;
/** Việt Nam UTC+7, không đổi giờ mùa hè. */
const VN_OFFSET_MIN = 7 * 60;
const LINE_MAX_BYTES = 75;

type CalendarStop = {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  visit_end_time: string | null;
  note: string | null;
  place: { name: string; address: string | null };
};

/** Escape TEXT theo RFC 5545: \ ; , và xuống dòng. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Giờ địa phương VN (YYYY-MM-DD + HH:MM) → "YYYYMMDDTHHMMSSZ" (UTC), cộng thêm `addMin` phút. */
function toUtc(date: string, time: string, addMin = 0): string {
  const [h, m] = time.split(':').map(Number);
  const ms = Date.parse(`${date}T00:00:00Z`) + (h * 60 + m + addMin - VN_OFFSET_MIN) * 60_000;
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Gập dòng dài theo byte UTF-8 (tối đa 75), không cắt giữa một ký tự nhiều byte. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? LINE_MAX_BYTES : LINE_MAX_BYTES - 1;
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** File .ics: mỗi chỗ đã xếp giờ là một sự kiện có nhắc trước REMINDER_MIN phút. */
export function buildTripIcs(trip: { id: string; name: string; city: string }, stops: CalendarStop[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Food Tour nhom//VI', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`${trip.name} · ${trip.city}`)}`];
  for (const s of stops) {
    if (!s.visit_date || !s.visit_time) continue;
    const end = s.visit_end_time ? toUtc(s.visit_date, s.visit_end_time) : toUtc(s.visit_date, s.visit_time, DEFAULT_STAY_MIN);
    const location = [s.place.address, trip.city].filter(Boolean).join(', ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@food-tour`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtc(s.visit_date, s.visit_time)}`,
      `DTEND:${end}`,
      `SUMMARY:${esc(s.place.name)}`,
      `LOCATION:${esc(location)}`,
      ...(s.note ? [`DESCRIPTION:${esc(s.note)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Sắp tới: ${s.place.name}`)}`,
      `TRIGGER:-PT${REMINDER_MIN}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
