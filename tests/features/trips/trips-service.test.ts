import { describe, expect, test, vi } from 'vitest';
import type { PlaceCandidate } from '@/integrations/google-places/types';
import { daysUntil, todayInVietnam } from '@/shared/date';
import { AppError } from '@/shared/errors';
import { toSummary, type Trip, type TripPlace, type TripSummary } from '@/features/trips/repositories/trips-repo';
import type { Place } from '@/features/places/repositories/places-repo';
import { addManualPlace, addToTrip, createTrip, importTripPlaces, listTrips, splitTrips, updateStop } from '@/features/trips/services/trips-service';

const trip = (id: string, startDate: string | null, endDate: string | null): Trip => ({
  id, group_id: 'g1', name: id, city: 'Hải Phòng', start_date: startDate, end_date: endDate, created_by: 'u1', party_size: 4,
  payer_bank_bin: null, payer_account_no: null, payer_account_name: null,
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

describe('addManualPlace', () => {
  function manualDeps(existing: { id: string } | null = null) {
    const trips = {
      getTrip: vi.fn(async () => trip('t1', '2026-11-23', '2026-11-24')),
      addPlaceToTrip: vi.fn(async () => tripPlace),
      updateTripPlace: vi.fn(async () => {}),
    };
    const places = {
      findLocalPlace: vi.fn(async () => existing),
      createLocalPlace: vi.fn(async () => ({ id: 'new-place' })),
    };
    return { trips, places };
  }
  const input = {
    tripId: 't1', userId: 'u1', name: '  Bánh đa cua bà Cụ ', address: '', category: 'food' as const, note: '',
    schedule: { date: '2026-11-23', time: '08:45', endTime: '09:30' }, transport: ' Xe máy thuê ', cost: 120000,
  };

  test('tạo chỗ thủ công theo thành phố của chuyến, rồi ghi giờ, phương tiện, giá trong một lần', async () => {
    const deps = manualDeps();
    const row = await addManualPlace(deps, input);
    expect(deps.places.findLocalPlace).toHaveBeenCalledWith('g1', 'hai phong', 'banh da cua ba cu');
    expect(deps.places.createLocalPlace).toHaveBeenCalledWith({ groupId: 'g1', userId: 'u1', name: 'Bánh đa cua bà Cụ', address: null, city: 'Hải Phòng', category: 'food' });
    expect(deps.trips.addPlaceToTrip).toHaveBeenCalledWith('t1', 'new-place', 'u1', undefined);
    expect(deps.trips.updateTripPlace).toHaveBeenCalledTimes(1);
    expect(deps.trips.updateTripPlace).toHaveBeenCalledWith('tp1', {
      schedule: { date: '2026-11-23', time: '08:45', endTime: '09:30' },
      transport: 'Xe máy thuê',
      cost: 120000,
    });
    expect(row).toMatchObject({ visit_date: '2026-11-23', visit_time: '08:45', visit_end_time: '09:30', transport: 'Xe máy thuê', cost: 120000 });
  });

  test('trùng tên chỗ thủ công đã có thì dùng lại; không nhập gì thêm thì không ghi đè', async () => {
    const deps = manualDeps({ id: 'old' });
    await addManualPlace(deps, { ...input, schedule: null, transport: '  ', cost: null });
    expect(deps.places.createLocalPlace).not.toHaveBeenCalled();
    expect(deps.trips.addPlaceToTrip).toHaveBeenCalledWith('t1', 'old', 'u1', undefined);
    expect(deps.trips.updateTripPlace).not.toHaveBeenCalled();
  });

  test('ngày ngoài chuyến, giờ kết thúc không sau giờ bắt đầu, tên rỗng → lỗi, không ghi gì', async () => {
    const deps = manualDeps();
    await expect(addManualPlace(deps, { ...input, schedule: { date: '2026-11-30', time: '09:00', endTime: null } })).rejects.toMatchObject({ code: 'INVALID_SCHEDULE' });
    await expect(addManualPlace(deps, { ...input, schedule: { date: '2026-11-23', time: '09:00', endTime: '09:00' } })).rejects.toMatchObject({ code: 'INVALID_SCHEDULE' });
    await expect(addManualPlace(deps, { ...input, name: '   ' })).rejects.toMatchObject({ code: 'INVALID_PLACE' });
    expect(deps.places.createLocalPlace).not.toHaveBeenCalled();
  });
});

describe('updateStop', () => {
  const repo = () => ({ getTrip: vi.fn(async () => trip('t1', '2026-11-23', '2026-11-24')), updateTripPlace: vi.fn(async () => {}) });

  test('bỏ giờ (null) luôn được; chỉ sửa giá thì không đụng lịch', async () => {
    const r = repo();
    await updateStop(r, { tripId: 't1', tripPlaceId: 'tp1', patch: { schedule: null } });
    expect(r.updateTripPlace).toHaveBeenLastCalledWith('tp1', { schedule: null });
    await updateStop(r, { tripId: 't1', tripPlaceId: 'tp1', patch: { cost: 50000 } });
    expect(r.updateTripPlace).toHaveBeenLastCalledWith('tp1', { cost: 50000 });
  });

  test('phương tiện rỗng thành null; lịch sai bị chặn', async () => {
    const r = repo();
    await updateStop(r, { tripId: 't1', tripPlaceId: 'tp1', patch: { transport: '   ' } });
    expect(r.updateTripPlace).toHaveBeenLastCalledWith('tp1', { transport: null });
    await expect(updateStop(r, { tripId: 't1', tripPlaceId: 'tp1', patch: { schedule: { date: '2026-11-25', time: '08:00', endTime: null } } })).rejects.toMatchObject({ code: 'INVALID_SCHEDULE' });
    await expect(updateStop(r, { tripId: 't1', tripPlaceId: 'tp1', patch: { schedule: { date: '2026-11-23', time: '10:00', endTime: '09:00' } } })).rejects.toMatchObject({ code: 'INVALID_SCHEDULE' });
  });
});

describe('importTripPlaces', () => {
  const rows = [
    { name: 'Bánh Đa Cua', category: 'food' as const, address: null, mapsUrl: 'https://m/x', note: 'sáng' },
    { name: 'Cafe mới', category: 'cafe' as const, address: '1 Lạch Tray', mapsUrl: null, note: null },
  ];
  const deps = (found: Trip | null = trip('t1', '2026-11-23', '2026-11-24')) => ({
    trips: { getTrip: vi.fn(async () => found), importPlaces: vi.fn(async () => ({ added: 1, skipped: 1 })) },
    places: { listLocalPlaces: vi.fn(async () => [{ id: 'p-old', name: 'banh da cua' }]) },
  });

  test('ghép chỗ sẵn có theo tên bỏ dấu, chỗ mới gửi place_id null; gọi RPC một lần', async () => {
    const d = deps();
    expect(await importTripPlaces(d, { tripId: 't1', rows })).toEqual({ added: 1, skipped: 1 });
    expect(d.places.listLocalPlaces).toHaveBeenCalledWith('g1', 'hai phong');
    expect(d.trips.importPlaces).toHaveBeenCalledTimes(1);
    expect(d.trips.importPlaces).toHaveBeenCalledWith('t1', [
      { place_id: 'p-old', name: 'Bánh Đa Cua', category: 'food', address: null, maps_url: 'https://m/x', note: 'sáng', city_norm: 'hai phong' },
      { place_id: null, name: 'Cafe mới', category: 'cafe', address: '1 Lạch Tray', maps_url: null, note: null, city_norm: 'hai phong' },
    ]);
  });

  test('không có dòng → IMPORT_EMPTY; chuyến không có → NOT_FOUND; không gọi RPC', async () => {
    const d = deps();
    await expect(importTripPlaces(d, { tripId: 't1', rows: [] })).rejects.toMatchObject({ code: 'IMPORT_EMPTY' });
    const gone = deps(null);
    await expect(importTripPlaces(gone, { tripId: 't1', rows })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.trips.importPlaces).not.toHaveBeenCalled();
    expect(gone.trips.importPlaces).not.toHaveBeenCalled();
  });
});
