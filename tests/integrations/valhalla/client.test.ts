import { afterEach, describe, expect, test, vi } from 'vitest';
import { createValhallaClient } from '@/integrations/valhalla/client';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const A = { lat: 20.85, lng: 106.68 };
const B = { lat: 20.84, lng: 106.69 };
const C = { lat: 20.86, lng: 106.67 };

describe('valhalla distanceMatrix', () => {
  test('gửi lat/lon + costing, đổi km sang mét; ô thiếu đường là null', async () => {
    const fetchMock = mockFetch({
      sources_to_targets: [[{ from_index: 0, to_index: 0, distance: 2.943 }, { from_index: 0, to_index: 1, distance: null }]],
    });
    const out = await createValhallaClient('https://v.example/', 'motor_scooter').distanceMatrix([A], [B, C]);
    expect(out).toEqual([[2943, null]]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://v.example/sources_to_targets');
    expect(JSON.parse(init.body)).toEqual({
      sources: [{ lat: 20.85, lon: 106.68 }],
      targets: [{ lat: 20.84, lon: 106.69 }, { lat: 20.86, lon: 106.67 }],
      costing: 'motor_scooter',
      units: 'kilometers',
    });
  });

  test('lỗi HTTP thành ROUTING_UNAVAILABLE', async () => {
    mockFetch({ error: 'x' }, 500);
    await expect(createValhallaClient('https://v.example', 'auto').distanceMatrix([A], [B])).rejects.toMatchObject({ code: 'ROUTING_UNAVAILABLE' });
  });

  test('không có điểm thì không gọi mạng', async () => {
    const fetchMock = mockFetch({});
    expect(await createValhallaClient('https://v.example', 'auto').distanceMatrix([A], [])).toEqual([[]]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
