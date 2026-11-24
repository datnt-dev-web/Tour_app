import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { DEFAULT_STAY_MIN, toMinutes } from './timeline';

/** Một chỗ trên trang lịch trình chia sẻ: chỉ thông tin lịch trình, không tiền, không ghi chú. Giờ dạng "HH:MM". */
export interface ShareStop {
  id: string;
  name: string;
  address: string | null;
  category: StoredPlaceCategory;
  date: string | null;
  start: string | null;
  end: string | null;
  visited: boolean;
  directions: string | null;
}

/** done: đã đi hoặc đã qua giờ; now: đang trong khung giờ; upcoming: chưa tới (hoặc chưa xếp giờ). */
export type StopPhase = 'done' | 'now' | 'upcoming';

const endMinutes = (s: Pick<ShareStop, 'start' | 'end'>) => (s.end ? toMinutes(s.end) : toMinutes(s.start!) + DEFAULT_STAY_MIN);

export function stopPhase(s: ShareStop, today: string, nowHHMM: string): StopPhase {
  if (s.visited) return 'done';
  if (!s.date || !s.start) return 'upcoming';
  if (s.date !== today) return s.date < today ? 'done' : 'upcoming';
  const now = toMinutes(nowHHMM);
  if (now >= endMinutes(s)) return 'done';
  return now >= toMinutes(s.start) ? 'now' : 'upcoming';
}

/**
 * Hôm nay có nằm trong các ngày của lịch trình không. Ngoài khoảng đó (chưa đi hoặc đi xong rồi) trang không đánh dấu
 * đã qua / đang diễn ra, để người xem lại lịch sau chuyến không thấy cả trang xám.
 */
export function isScheduleLive(stops: Pick<ShareStop, 'date'>[], today: string): boolean {
  const dates = stops.flatMap((s) => (s.date ? [s.date] : [])).sort();
  return dates.length > 0 && dates[0] <= today && today <= dates[dates.length - 1];
}

/** Số phút ở chỗ (để vẽ khối cao theo thời lượng); chưa xếp giờ là 0. */
export const stayMinutes = (s: Pick<ShareStop, 'start' | 'end'>) => (s.start ? Math.max(0, endMinutes(s) - toMinutes(s.start)) : 0);

/** Số phút trống từ lúc rời `a` tới lúc đến `b` (cùng ngày); không xếp giờ hoặc chồng giờ thì 0. */
export function freeMinutes(a: Pick<ShareStop, 'start' | 'end'>, b: Pick<ShareStop, 'start'>): number {
  if (!a.start || !b.start) return 0;
  return Math.max(0, toMinutes(b.start) - endMinutes(a));
}

/** "1 tiếng 15 phút", "30 phút". */
export const formatDuration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} tiếng${min % 60 ? ` ${min % 60} phút` : ''}` : `${min} phút`);

/** Gom theo ngày, giữ thứ tự đầu vào (đã sắp theo ngày, giờ); chỗ chưa xếp ngày (date null) nằm nhóm cuối. */
export function groupByDay(stops: ShareStop[]): { date: string | null; stops: ShareStop[] }[] {
  const days = new Map<string | null, ShareStop[]>();
  for (const s of stops) days.set(s.date, [...(days.get(s.date) ?? []), s]);
  return [...days].map(([date, list]) => ({ date, stops: list })).sort((a, b) => (a.date === null ? 1 : b.date === null ? -1 : 0));
}
