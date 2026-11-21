import { formatDayMonth } from '@/shared/date';
import type { Trip, TripPlace } from '../repositories/trips-repo';

/** Chuyến dài hơn mức này coi là nhập nhầm ngày; không liệt kê để khỏi dựng danh sách ngày khổng lồ. */
const MAX_TRIP_DAYS = 31;
const DAY_MS = 86_400_000;
/** Gợi ý giờ: chỗ đầu tiên trong ngày, và khoảng cách tới chỗ kế tiếp. */
export const FIRST_SLOT = '08:00';
export const SLOT_STEP_MIN = 60;
/** Thời gian đi đường mặc định giữa hai chỗ (giống bảng kế hoạch: 09:30 xong thì 09:45 sang chỗ sau). */
export const TRAVEL_GAP_MIN = 15;
const LAST_SLOT_MIN = 23 * 60;
const DAY_END_MIN = 23 * 60 + 59;

/** Postgres trả `time` dạng "09:30:00"; giao diện và input[type=time] dùng "09:30". */
export const toHHMM = (time: string) => time.slice(0, 5);

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "09:30" + 45 phút → "10:15", không vượt 23:59 (khung giờ trong một ngày). */
export const addMinutes = (hhmm: string, minutes: number) => fromMinutes(Math.min(toMinutes(hhmm) + minutes, DAY_END_MIN));

/** "08:45:00", "09:30:00" → "08:45 - 09:30"; không có giờ kết thúc thì chỉ giờ bắt đầu. */
export const formatSlot = (start: string, end: string | null) => (end ? `${toHHMM(start)} - ${toHHMM(end)}` : toHHMM(start));

/** Các ngày (YYYY-MM-DD) của chuyến, từ ngày đi tới ngày về. Thiếu ngày thì rỗng. */
export function tripDays(trip: Pick<Trip, 'start_date' | 'end_date'>): string[] {
  const { start_date: start, end_date: end } = trip;
  if (!start) return [];
  const last = end && end >= start ? end : start;
  const days: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(last) && days.length < MAX_TRIP_DAYS; t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

type Slot = Pick<TripPlace, 'visit_date' | 'visit_time' | 'visit_end_time'>;
export type Scheduled<T> = T & { visit_date: string; visit_time: string };
export interface TimelineDay<T> {
  date: string;
  /** Thứ tự ngày trong chuyến (1-based); null khi ngày nằm ngoài khoảng chuyến. */
  dayNumber: number | null;
  stops: { item: Scheduled<T>; clash: boolean }[];
}
export interface Timeline<T> {
  days: TimelineDay<T>[];
  unscheduled: T[];
}

const isScheduled = <T extends Slot>(i: T): i is Scheduled<T> => i.visit_date !== null && i.visit_time !== null;

/**
 * Gom các chỗ theo ngày, trong ngày theo giờ bắt đầu (9:00, 9:30, 10:00...), bất kể thứ tự thêm vào.
 * `clash` (khung giờ chồng nhau) lấy từ database, nơi tính trên cả ngày kể cả phần ở trang khác.
 */
export function buildTimeline<T extends Slot & { clash: boolean }>(items: T[], days: string[]): Timeline<T> {
  const scheduled = items.filter(isScheduled);
  const byDate = new Map<string, Scheduled<T>[]>();
  for (const item of scheduled) byDate.set(item.visit_date, [...(byDate.get(item.visit_date) ?? []), item]);

  const timelineDays = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => a.visit_time.localeCompare(b.visit_time));
      const index = days.indexOf(date);
      return { date, dayNumber: index === -1 ? null : index + 1, stops: sorted.map((item) => ({ item, clash: item.clash })) };
    });
  return { days: timelineDays, unscheduled: items.filter((i) => !isScheduled(i)) };
}

/**
 * Giờ gợi ý cho chỗ mới trong ngày: chỗ có giờ kết thúc thì sau đó một quãng đi đường,
 * chỗ chỉ có giờ bắt đầu thì sau đó một tiếng; ngày còn trống thì giờ đầu ngày.
 */
export function suggestTime(items: Slot[], date: string): string {
  const next = items
    .filter((i) => i.visit_date === date && i.visit_time)
    .map((i) => (i.visit_end_time ? toMinutes(toHHMM(i.visit_end_time)) + TRAVEL_GAP_MIN : toMinutes(toHHMM(i.visit_time!)) + SLOT_STEP_MIN))
    .reduce((max, m) => Math.max(max, m), -1);
  return next === -1 ? FIRST_SLOT : fromMinutes(Math.min(next, LAST_SLOT_MIN));
}

/** Phương tiện mặc định cho chỗ mới: của chỗ muộn nhất đã ghi phương tiện (nhóm thường giữ một kiểu đi suốt chuyến). */
export function lastTransport(items: (Slot & Pick<TripPlace, 'transport'>)[]): string | null {
  const withTransport = items.filter((i) => i.transport);
  const key = (i: Slot) => `${i.visit_date ?? ''}T${i.visit_time ?? ''}`;
  return withTransport.reduce<(typeof withTransport)[number] | null>((best, i) => (!best || key(i) > key(best) ? i : best), null)?.transport ?? null;
}

/** Ngày mặc định khi xếp giờ: hôm nay nếu đang trong chuyến, ngược lại ngày đầu. */
export function defaultDay(days: string[], today: string): string | null {
  return days.includes(today) ? today : (days[0] ?? null);
}

/** "23/11 - 24/11" (hoặc một ngày); rỗng khi chuyến chưa có ngày. File thuần để Server Component dùng được. */
export function dateRange(t: Pick<Trip, 'start_date' | 'end_date'>): string {
  if (!t.start_date) return '';
  return t.end_date && t.end_date !== t.start_date ? `${formatDayMonth(t.start_date)} - ${formatDayMonth(t.end_date)}` : formatDayMonth(t.start_date);
}

/** Chỗ không có giờ kết thúc coi như ở ngần này phút (đủ một bữa). */
export const DEFAULT_STAY_MIN = 60;

type ReflowStop = { id: string; visit_date: string | null; visit_time: string | null; visit_end_time: string | null };

/**
 * Sau khi kéo thả trong một ngày: xếp lại giờ theo thứ tự mới, bắt đầu từ giờ sớm nhất của ngày, mỗi chỗ giữ thời lượng,
 * giữa hai chỗ chừa TRAVEL_GAP_MIN phút đi lại. Chỉ trả những chỗ đổi giờ (đỡ ghi thừa).
 */
export function reflowDay(ordered: ReflowStop[]): { id: string; schedule: { date: string; time: string; endTime: string | null } }[] {
  const timed = ordered.filter((s) => s.visit_date && s.visit_time);
  if (timed.length === 0) return [];
  const date = timed[0].visit_date!;
  let cursor = Math.min(...timed.map((s) => toMinutes(s.visit_time!)));
  const changes: { id: string; schedule: { date: string; time: string; endTime: string | null } }[] = [];
  for (const s of timed) {
    const duration = s.visit_end_time ? toMinutes(s.visit_end_time) - toMinutes(s.visit_time!) : DEFAULT_STAY_MIN;
    const start = Math.min(cursor, DAY_END_MIN);
    const time = fromMinutes(start);
    const endTime = s.visit_end_time ? addMinutes(time, duration) : null;
    const effectiveEnd = endTime && endTime > time ? endTime : null;
    if (time !== toHHMM(s.visit_time!) || (effectiveEnd ?? null) !== (s.visit_end_time ? toHHMM(s.visit_end_time) : null)) {
      changes.push({ id: s.id, schedule: { date, time, endTime: s.visit_end_time ? effectiveEnd : null } });
    }
    cursor = start + duration + TRAVEL_GAP_MIN;
  }
  return changes;
}
