import { describe, expect, test, vi } from 'vitest';
import type { PlaceCandidate } from '@/integrations/google-places/types';
import { daysUntil, todayInVietnam } from '@/shared/date';
import { AppError } from '@/shared/errors';
import { toSummary, type Trip, type TripPlace, type TripSummary } from '@/features/trips/repositories/trips-repo';
import type { Place } from '@/features/places/repositories/places-repo';
import { addToTrip, createTrip, listTrips, splitTrips } from '@/features/trips/services/trips-service';

const trip = (id: string, startDate: string | null, endDate: string | null): Trip => ({
  id, group_id: 'g1', name: id, city: 'Hải Phòng', start_date: startDate, end_date: endDate, created_by: 'u1',
});
const summary = (t: Trip, confirmedCount = 0, pendingCount = 0): TripSummary => ({ ...t, confirmedCount, pendingCount });

const candidate: PlaceCandidate = {
  googlePlaceId: 'gp1', name: 'Quán A', address: 'Số 1', rating: 4.5, reviewCount: 100, priceTier: 1, openNow: null, mapsUrl: 'u',
};
const place = { id: 'p1', group_id: 'g1' } as Place;
const tripPlace = { id: 'tp1', trip_id: 't1', place_id: 'p1', status: 'wanted' } as TripPlace;

function fakeDeps(found: Trip | null = trip('t1', '2026-12-01', '2026-12-03')) {
  const trips = {
    getTrip: vi.fn(async () => found),
    addPlaceToTrip: vi.fn(async () => tripPlace),
    createTrip: vi.fn(async (i: { groupId: string; name: string; city: string; startDate: string; endDate: string }) =>
      trip('new', i.startDate, i.endDate)),
    listTrips: vi.fn(async () => [] as TripSummary[]),
  };
  const places = { upsertPlaceFromGoogle: vi.fn(async () => place) };
  return { trips, places };
}

describe('todayInVietnam / daysUntil', () => {
  test('00:30 ngày 20 giờ VN (17:30Z ngày 19) vẫn là ngày 20', () => {
    expect(todayInVietnam(new Date('2026-11-19T17:30:00Z'))).toBe('2026-11-20');
    expect(todayInVietnam(new Date('2026-11-19T16:30:00Z'))).toBe('2026-11-19');
  });
  test('daysUntil đếm số ngày lịch', () => {
    expect(daysUntil('2026-11-25', '2026-11-20')).toBe(5);
    expect(daysUntil('2026-11-20', '2026-11-20')).toBe(0);
    expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
  });
});

describe('splitTrips / listTrips', () => {
  test('tách upcoming/past theo end_date so với hôm nay (Asia/Ho_Chi_Minh)', async () => {
    const trips = [
      summary(trip('past', '2026-11-17', '2026-11-19')),
      summary(trip('today', '2026-11-18', '2026-11-20')),
      summary(trip('later', '2026-12-10', '2026-12-12')),
      summary(trip('soon', '2026-11-25', '2026-11-26')),
      summary(trip('older', '2026-10-01', '2026-10-03')),
    ];
    // 17:30Z ngày 19 = 00:30 ngày 20 tại VN: chuyến kết thúc 19/11 đã là quá khứ (theo UTC thì chưa)
    const now = new Date('2026-11-19T17:30:00Z');
    const repo = { listTrips: vi.fn(async () => trips) };
    const r = await listTrips(repo, 'g1', todayInVietnam(now));
    expect(r.upcoming.map((t) => t.id)).toEqual(['today', 'soon', 'later']);
    expect(r.past.map((t) => t.id)).toEqual(['past', 'older']);
  });

  test('chuyến không có ngày kết thúc coi là sắp đi', () => {
    const r = splitTrips([summary(trip('x', null, null))], '2026-11-20');
    expect(r.upcoming).toHaveLength(1);
  });
});

describe('toSummary', () => {
  test('đếm confirmed (gồm visited) và pending (wanted), bỏ qua dropped', () => {
    const row = {
      ...trip('t', null, null),
      trip_places: [{ status: 'confirmed' }, { status: 'confirmed' }, { status: 'visited' }, { status: 'wanted' }, { status: 'dropped' }],
    };
    const s = toSummary(row as Parameters<typeof toSummary>[0]);
    expect(s.confirmedCount).toBe(3);
    expect(s.pendingCount).toBe(1);
    expect('trip_places' in s).toBe(false);
  });
});

describe('createTrip', () => {
  const input = { groupId: 'g1', name: ' Hải Phòng 3N ', city: ' Hải Phòng ', startDate: '2026-12-01', endDate: '2026-12-03' };
  test('trim tên/thành phố rồi gọi repo', async () => {
    const { trips } = fakeDeps();
    await createTrip(trips, input);
    expect(trips.createTrip).toHaveBeenCalledWith({ ...input, name: 'Hải Phòng 3N', city: 'Hải Phòng' });
  });
  test('ngày kết thúc trước ngày bắt đầu bị từ chối', async () => {
    const { trips } = fakeDeps();
    await expect(createTrip(trips, { ...input, endDate: '2026-11-30' })).rejects.toMatchObject({ code: 'INVALID_TRIP' });
    expect(trips.createTrip).not.toHaveBeenCalled();
  });
});

describe('addToTrip', () => {
  test('candidate: upsert place theo nhóm của chuyến rồi thêm vào chuyến', async () => {
    const deps = fakeDeps();
    const r = await addToTrip(deps, { tripId: 't1', userId: 'u1', candidate, category: 'food', city: 'Hải Phòng' });
    expect(deps.places.upsertPlaceFromGoogle).toHaveBeenCalledWith('g1', candidate, 'food', 'Hải Phòng', 'u1');
    expect(deps.trips.addPlaceToTrip).toHaveBeenCalledWith('t1', 'p1', 'u1', undefined);
    expect(r).toBe(tripPlace);
  });
  test('placeId: bỏ qua bước upsert', async () => {
    const deps = fakeDeps();
    await addToTrip(deps, { tripId: 't1', userId: 'u1', placeId: 'p9', category: 'food', city: 'x', note: 'n' });
    expect(deps.places.upsertPlaceFromGoogle).not.toHaveBeenCalled();
    expect(deps.trips.addPlaceToTrip).toHaveBeenCalledWith('t1', 'p9', 'u1', 'n');
  });
  test('chuyến không tồn tại: NOT_FOUND', async () => {
    const deps = fakeDeps(null);
    await expect(addToTrip(deps, { tripId: 'zz', userId: 'u1', placeId: 'p1', category: 'food', city: 'x' })).rejects.toBeInstanceOf(AppError);
    expect(deps.trips.addPlaceToTrip).not.toHaveBeenCalled();
  });
});
