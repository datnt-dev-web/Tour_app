import { describe, expect, test, vi } from 'vitest';
import { CITY_RADIUS_M, exploreNearby, NEAR_ME_RADIUS_M, pickBookForExplore } from '@/features/explore/services/nearby-service';
import type { BookRow } from '@/features/places/services/book-service';
import { MemoryCacheStore } from '@/shared/cache/memory-store';

const place = (id: string, lat: number, lng: number) => ({ osmId: id, name: id, address: null, lat, lng });

function deps(found = [place('xa', 20.9, 106.7), place('gan', 20.861, 106.681)]) {
  return {
    osm: { around: vi.fn(async () => found) },
    geocoder: { geocode: vi.fn(async () => ({ lat: 20.86, lng: 106.68 })) },
    cache: new MemoryCacheStore(),
  };
}

describe('exploreNearby', () => {
  test('"Gần tôi": tìm quanh vị trí với bán kính gần, sắp theo khoảng cách, kèm số mét', async () => {
    const d = deps();
    const r = await exploreNearby(d, { category: 'cafe', at: { lat: 20.86, lng: 106.68 } });
    expect(d.osm.around).toHaveBeenCalledWith('cafe', { lat: 20.86, lng: 106.68 }, NEAR_ME_RADIUS_M);
    expect(d.geocoder.geocode).not.toHaveBeenCalled();
    expect(r.places.map((p) => p.osmId)).toEqual(['gan', 'xa']);
    expect(r.places[0].distanceM).toBeGreaterThan(0);
    expect(r.places[0].distanceM).toBeLessThan(r.places[1].distanceM);
  });

  test('theo thành phố: lấy tâm thành phố (OSM) rồi tìm với bán kính rộng', async () => {
    const d = deps();
    const r = await exploreNearby(d, { category: 'food', city: 'Hải Phòng' });
    expect(d.geocoder.geocode).toHaveBeenCalledWith('Hải Phòng, Việt Nam');
    expect(d.osm.around).toHaveBeenCalledWith('food', { lat: 20.86, lng: 106.68 }, CITY_RADIUS_M);
    expect(r.center).toEqual({ lat: 20.86, lng: 106.68 });
  });

  test('thành phố không tìm thấy → NOT_FOUND', async () => {
    const d = deps();
    d.geocoder.geocode.mockResolvedValueOnce(null as never);
    await expect(exploreNearby(d, { category: 'food', city: 'Xyz' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('cùng khu vực (làm tròn tọa độ) và cùng loại thì lần sau lấy từ cache', async () => {
    const d = deps();
    await exploreNearby(d, { category: 'cafe', at: { lat: 20.86001, lng: 106.68001 } });
    await exploreNearby(d, { category: 'cafe', at: { lat: 20.86002, lng: 106.68002 } });
    expect(d.osm.around).toHaveBeenCalledTimes(1);
  });
});

describe('pickBookForExplore', () => {
  const row = (name: string, verdict: BookRow['verdict'], over: Partial<BookRow> = {}): BookRow => ({
    placeId: name, googlePlaceId: null, name, address: null, city: 'Hải Phòng', cityKey: 'hai phong', category: 'food', verified: false, verdict, note: null, ...over,
  });

  test('cùng thành phố + loại; khen trước, chưa thử giữa, chê sau', () => {
    const rows = [row('Che', 'down'), row('Moi', 'none'), row('Khen', 'up'), row('Cafe', 'up', { category: 'cafe' }), row('HN', 'up', { cityKey: 'ha noi' })];
    expect(pickBookForExplore(rows, 'Hải Phòng', 'food').map((r) => r.name)).toEqual(['Khen', 'Moi', 'Che']);
  });
});
