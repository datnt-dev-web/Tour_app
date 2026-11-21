import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import type { Trip, TripPlaceStatus } from '../repositories/trips-repo';
import { tripDays } from './timeline';

/** Số quán nổi bật hiện trên trang tổng kết. */
export const RECAP_TOP = 3;

type RecapStop = {
  id: string;
  place_id: string;
  status: TripPlaceStatus;
  visit_date: string | null;
  visit_time: string | null;
  place: { name: string; category: StoredPlaceCategory };
};
type RecapReview = { place_id: string; verdict: 'up' | 'down'; rating: number | null };

export interface Recap {
  days: number;
  visitedCount: number;
  route: { date: string; names: string[] }[];
  top: { placeId: string; name: string; avgRating: number | null; ups: number }[];
}

/** Số liệu trang tổng kết: chỉ tính chỗ đã đi; top quán theo sao trung bình rồi số lượt khen. */
export function buildRecap(trip: Pick<Trip, 'start_date' | 'end_date'>, stops: RecapStop[], reviews: RecapReview[]): Recap {
  const visited = stops.filter((s) => s.status === 'visited');

  const byDay = new Map<string, RecapStop[]>();
  for (const s of visited) if (s.visit_date) byDay.set(s.visit_date, [...(byDay.get(s.visit_date) ?? []), s]);
  const route = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, names: list.sort((x, y) => (x.visit_time ?? '').localeCompare(y.visit_time ?? '')).map((s) => s.place.name) }));

  const visitedPlaces = new Map(visited.map((s) => [s.place_id, s.place.name]));
  const scores = new Map<string, { sum: number; n: number; ups: number }>();
  for (const r of reviews) {
    if (!visitedPlaces.has(r.place_id)) continue;
    const cur = scores.get(r.place_id) ?? { sum: 0, n: 0, ups: 0 };
    if (r.rating) {
      cur.sum += r.rating;
      cur.n += 1;
    }
    if (r.verdict === 'up') cur.ups += 1;
    scores.set(r.place_id, cur);
  }
  const top = [...scores.entries()]
    .map(([placeId, s]) => ({ placeId, name: visitedPlaces.get(placeId)!, avgRating: s.n ? Math.round((s.sum / s.n) * 10) / 10 : null, ups: s.ups }))
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ups - a.ups)
    .slice(0, RECAP_TOP);

  return { days: tripDays(trip).length, visitedCount: visited.length, route, top };
}
