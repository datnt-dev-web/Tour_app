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
