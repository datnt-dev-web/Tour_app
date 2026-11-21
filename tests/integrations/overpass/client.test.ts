import { describe, expect, test, vi } from 'vitest';
import { buildOverpassQuery, createOverpassClient, toNearbyPlace } from '@/integrations/overpass/client';

describe('buildOverpassQuery', () => {
  test('quán ăn: restaurant + fast_food có tên, trong bán kính quanh tâm, trả tâm điểm (center)', () => {
    const q = buildOverpassQuery('food', { lat: 20.86, lng: 106.68 }, 2000);
    expect(q).toContain('[out:json]');
    expect(q).toContain('nwr["amenity"="restaurant"]["name"](around:2000,20.86,106.68);');
    expect(q).toContain('nwr["amenity"="fast_food"]["name"](around:2000,20.86,106.68);');
    expect(q).toMatch(/out center \d+;/);
  });

  test('mỗi loại của app đều có điều kiện OSM', () => {
    for (const c of ['food', 'snack', 'cafe', 'play', 'stay', 'gift'] as const) {
      expect(buildOverpassQuery(c, { lat: 1, lng: 2 }, 500)).toContain('(around:500,1,2)');
    }
  });
});

describe('toNearbyPlace', () => {
  test('node lấy lat/lon, way lấy center; ghép địa chỉ từ addr:*', () => {
    expect(
      toNearbyPlace({ type: 'node', id: 1, lat: 20.1, lon: 106.2, tags: { name: 'Bánh đa cua Bà Cụ', 'addr:housenumber': '179', 'addr:street': 'Cầu Đất' } }),
    ).toEqual({ osmId: 'node/1', name: 'Bánh đa cua Bà Cụ', address: '179 Cầu Đất', lat: 20.1, lng: 106.2 });
    expect(toNearbyPlace({ type: 'way', id: 2, center: { lat: 1, lon: 2 }, tags: { name: 'Chợ' } })).toEqual({ osmId: 'way/2', name: 'Chợ', address: null, lat: 1, lng: 2 });
  });

  test('thiếu tên hoặc tọa độ thì bỏ', () => {
    expect(toNearbyPlace({ type: 'node', id: 3, lat: 1, lon: 2, tags: {} })).toBeNull();
    expect(toNearbyPlace({ type: 'way', id: 4, tags: { name: 'X' } })).toBeNull();
  });
});

describe('createOverpassClient', () => {
  test('lỗi mạng hoặc HTTP thì EXPLORE_UNAVAILABLE', async () => {
    const fetchFn = vi.fn(async () => new Response('busy', { status: 429 }));
    const client = createOverpassClient({ url: 'https://overpass.test/api', fetchFn });
    await expect(client.around('cafe', { lat: 1, lng: 2 }, 500)).rejects.toMatchObject({ code: 'EXPLORE_UNAVAILABLE' });
  });

  test('gửi truy vấn bằng POST và trả danh sách đã lọc', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ elements: [{ type: 'node', id: 9, lat: 1, lon: 2, tags: { name: 'Cafe A' } }, { type: 'node', id: 10, tags: {} }] }),
    );
    const client = createOverpassClient({ url: 'https://overpass.test/api', fetchFn });
    expect(await client.around('cafe', { lat: 1, lng: 2 }, 500)).toEqual([{ osmId: 'node/9', name: 'Cafe A', address: null, lat: 1, lng: 2 }]);
    expect(fetchFn).toHaveBeenCalledWith('https://overpass.test/api', expect.objectContaining({ method: 'POST' }));
  });
});
