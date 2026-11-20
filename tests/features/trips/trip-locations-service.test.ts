import { describe, expect, test, vi } from 'vitest';
import { getTripLocations, type TripLocationsDeps } from '@/features/trips/services/trip-locations-service';
import type { TripDetail, TripPlaceItem } from '@/features/trips/repositories/trips-repo';
import type { PlaceDetails } from '@/integrations/google-places/types';
import { MemoryCacheStore } from '@/shared/cache/memory-store';
import { AppError } from '@/shared/errors';

vi.mock('@/shared/config/env', () => ({ getEnv: () => ({ PLACES_TTL_SEC: 86400, GEOCODE_TTL_SEC: 2592000 }) }));

const GROUP = 'G';
const item = (id: string, place: Record<string, unknown>, status: TripPlaceItem['status'] = 'wanted') =>
  ({
    id,
    status,
    place: { id: `p-${id}`, name: `Quán ${id}`, address: null, google_place_id: null, ...place },
  }) as unknown as TripPlaceItem;

const detail = (items: TripPlaceItem[], group = GROUP): TripDetail =>
  ({ trip: { id: 'T', group_id: group, city: 'Hải Phòng' }, items }) as unknown as TripDetail;

type Over = Partial<{
  getDetails: () => Promise<PlaceDetails>;
  geocode: (a: string) => Promise<{ lat: number; lng: number } | null>;
}>;

function setup(items: TripPlaceItem[], over: Over = {}, googleEnabled = true) {
  const getDetails = vi.fn(over.getDetails ?? (async () => ({ location: { lat: 1, lng: 2 } }) as PlaceDetails));
  const geocode = vi.fn(over.geocode ?? (async () => ({ lat: 3, lng: 4 })));
  const deps: TripLocationsDeps = {
    places: { getDetails },
    geocoder: { geocode },
    googleEnabled,
    cache: new MemoryCacheStore(),
    tripsRepo: { getTripDetail: async () => detail(items) },
  };
  return { deps, getDetails, geocode };
}

describe('getTripLocations', () => {
  test('chỗ Google lấy tọa độ từ details', async () => {
    const { deps, geocode } = setup([item('a', { google_place_id: 'g1', address: 'Số 1' })]);
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(r.points).toEqual([
      { tripPlaceId: 'a', placeKey: 'g1', name: 'Quán a', address: 'Số 1', status: 'wanted', lat: 1, lng: 2, googlePlaceId: 'g1' },
    ]);
    expect(r.missing).toBe(0);
    expect(geocode).not.toHaveBeenCalled();
  });

  test('chỗ thêm tay có địa chỉ thì geocode "địa chỉ, thành phố, Việt Nam"', async () => {
    const { deps, geocode } = setup([item('b', { address: '12 Lạch Tray' })]);
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledWith('12 Lạch Tray, Hải Phòng, Việt Nam');
    expect(r.points[0]).toMatchObject({ lat: 3, lng: 4, placeKey: 'local:p-b', googlePlaceId: null });
  });

  test('địa chỉ không ra kết quả thì thử lại theo tên quán', async () => {
    const geocode = vi.fn(async (q: string) => (q.startsWith('Quán b') ? { lat: 5, lng: 6 } : null));
    const { deps } = setup([item('b', { address: '12 Lạch Tray' })], { geocode });
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(geocode.mock.calls.map((c) => c[0])).toEqual(['12 Lạch Tray, Hải Phòng, Việt Nam', 'Quán b, Hải Phòng, Việt Nam']);
    expect(r.points[0]).toMatchObject({ lat: 5, lng: 6 });
  });

  test('Google tắt (khóa giữ chỗ): không gọi Google, dùng OSM', async () => {
    const { deps, getDetails, geocode } = setup([item('a', { google_place_id: 'g1', address: 'Số 1' })], {}, false);
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(getDetails).not.toHaveBeenCalled();
    expect(geocode).toHaveBeenCalledWith('Số 1, Hải Phòng, Việt Nam');
    expect(r.points[0]).toMatchObject({ lat: 3, lng: 4 });
  });

  test('địa chỉ trống hoặc "(...)" bị bỏ qua, chỉ thử theo tên; không ra thì missing; dropped bị bỏ', async () => {
    const { deps, geocode } = setup([
      item('a', { address: null }),
      item('b', { address: '(chưa rõ)' }),
      item('c', { address: '  ' }),
      item('d', { address: 'Số 9' }, 'dropped'),
    ], { geocode: async () => null });
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(r).toEqual({ points: [], missing: 3 });
    expect(geocode.mock.calls.map((c) => c[0])).toEqual(['Quán a, Hải Phòng, Việt Nam', 'Quán b, Hải Phòng, Việt Nam', 'Quán c, Hải Phòng, Việt Nam']);
  });

  test('ZERO_RESULTS tính missing và không cache', async () => {
    const { deps, geocode } = setup([item('a', { address: 'Đâu đó' })], { geocode: async () => null });
    expect((await getTripLocations(deps, GROUP, 'T')).missing).toBe(1);
    await getTripLocations(deps, GROUP, 'T');
    // Mỗi lượt thử cả địa chỉ lẫn tên, và cả hai đều không được cache.
    expect(geocode).toHaveBeenCalledTimes(4);
  });

  test('một chỗ lỗi không làm hỏng cả kết quả', async () => {
    const { deps } = setup([item('a', { google_place_id: 'bad' }), item('b', { address: 'Số 2' })], {
      getDetails: async () => {
        throw new AppError('PLACES_UNAVAILABLE', 'x');
      },
    });
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(r.points.map((p) => p.tripPlaceId)).toEqual(['b']);
    expect(r.missing).toBe(1);
  });

  test('details không có tọa độ thì rơi về geocode theo địa chỉ', async () => {
    const { deps, geocode } = setup([item('a', { google_place_id: 'g1', address: 'Số 1' })], {
      getDetails: async () => ({ location: null }) as PlaceDetails,
    });
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(r.points).toHaveLength(1);
  });

  test('cache hit tránh gọi lần hai', async () => {
    const { deps, getDetails, geocode } = setup([item('a', { google_place_id: 'g1' }), item('b', { address: 'Số 2' })]);
    await getTripLocations(deps, GROUP, 'T');
    const r = await getTripLocations(deps, GROUP, 'T');
    expect(getDetails).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(r.points).toHaveLength(2);
  });

  test('chuyến không thấy hoặc thuộc nhóm khác: NOT_FOUND', async () => {
    const { deps } = setup([]);
    deps.tripsRepo = { getTripDetail: async () => null };
    await expect(getTripLocations(deps, GROUP, 'T')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    deps.tripsRepo = { getTripDetail: async () => detail([], 'OTHER') };
    await expect(getTripLocations(deps, GROUP, 'T')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
