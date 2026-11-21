import type { Trip, TripPlaceStatus } from '../repositories/trips-repo';
import { toMinutes } from './timeline';

/** Chỗ không có giờ kết thúc coi như ở ngần này phút (đủ một bữa). */
export const DEFAULT_STAY_MIN = 60;

type TodayStop = { id: string; status: TripPlaceStatus; visit_time: string | null; visit_end_time: string | null };

export interface TodayPlan<T extends TodayStop> {
  /** Đang trong khung giờ của chỗ này (chưa bấm "Đã tới"). */
  current: { stop: T } | null;
  /** Chỗ nên tới tiếp; minutesUntil âm = đã trễ, null = chưa xếp giờ. */
  next: { stop: T; minutesUntil: number | null } | null;
  /** Các chỗ chưa đi còn lại (theo giờ, chỗ chưa xếp giờ ở cuối). */
  upcoming: T[];
  done: T[];
}

const byTime = <T extends TodayStop>(a: T, b: T) => (a.visit_time ?? '99').localeCompare(b.visit_time ?? '99');

/** Chia các chỗ của hôm nay theo giờ hiện tại (HH:MM): đang ở, kế tiếp, còn lại, đã đi. */
export function planToday<T extends TodayStop>(stops: T[], now: string): TodayPlan<T> {
  const nowMin = toMinutes(now);
  const done = stops.filter((s) => s.status === 'visited').sort(byTime);
  const pending = stops.filter((s) => s.status !== 'visited').sort(byTime);

  const endOf = (s: T) => (s.visit_end_time ? toMinutes(s.visit_end_time) : toMinutes(s.visit_time!) + DEFAULT_STAY_MIN);
  const current = pending.find((s) => s.visit_time && toMinutes(s.visit_time) <= nowMin && nowMin < endOf(s)) ?? null;
  const rest = pending.filter((s) => s !== current);
  // Chỗ đã quá giờ mà chưa tới vẫn đứng đầu: nhóm thường đi trễ chứ không bỏ.
  const nextStop = current ? rest.find((s) => !s.visit_time || toMinutes(s.visit_time) >= toMinutes(current.visit_time!)) ?? null : (rest[0] ?? null);
  const next = nextStop ? { stop: nextStop, minutesUntil: nextStop.visit_time ? toMinutes(nextStop.visit_time) - nowMin : null } : null;

  return { current: current ? { stop: current } : null, next, upcoming: rest.filter((s) => s !== nextStop), done };
}

/** Hôm nay có nằm trong ngày đi của chuyến không (tính cả ngày đầu và ngày cuối). */
export function isTripOngoing(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): boolean {
  if (!trip.start_date) return false;
  return trip.start_date <= today && today <= (trip.end_date ?? trip.start_date);
}
