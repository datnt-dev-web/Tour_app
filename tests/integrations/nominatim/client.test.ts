import { afterEach, describe, expect, test, vi } from 'vitest';
import { createNominatimClient, createThrottle, MIN_GAP_MS } from '@/integrations/nominatim/client';
import { AppError } from '@/shared/errors';

const noThrottle = { run: <T>(fn: () => Promise<T>) => fn() };

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('nominatim geocode', () => {
  test('gửi đúng URL, tham số và User-Agent', async () => {
    const fetchMock = mockFetch([{ lat: '1', lon: '2' }]);
    await createNominatimClient({ throttle: noThrottle }).geocode('92 Trần Nhật Duật, Hải Phòng, Việt Nam');
    const [rawUrl, init] = fetchMock.mock.calls[0];
    const url = new URL(rawUrl);
    expect(`${url.origin}${url.pathname}`).toBe('https://nominatim.openstreetmap.org/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'vn',
      'accept-language': 'vi',
      q: '92 Trần Nhật Duật, Hải Phòng, Việt Nam',
    });
    expect(init.headers['User-Agent']).toBe('FoodTourNhom/1.0 (self-hosted group app)');
  });

  test('kết quả đổi chuỗi lat/lon sang số', async () => {
    mockFetch([{ lat: '20.85', lon: '106.68' }]);
    expect(await createNominatimClient({ throttle: noThrottle }).geocode('x')).toEqual({ lat: 20.85, lng: 106.68 });
  });

  test('mảng rỗng trả null', async () => {
    mockFetch([]);
    expect(await createNominatimClient({ throttle: noThrottle }).geocode('x')).toBeNull();
  });

  test('HTTP lỗi ném GEOCODE_UNAVAILABLE', async () => {
    mockFetch({}, 429);
    const err = await createNominatimClient({ throttle: noThrottle }).geocode('x').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('GEOCODE_UNAVAILABLE');
    expect(err.message).toBe('Không lấy được vị trí, thử lại sau.');
  });

  test('lỗi mạng ném GEOCODE_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const err = await createNominatimClient({ throttle: noThrottle }).geocode('x').catch((e) => e);
    expect(err.code).toBe('GEOCODE_UNAVAILABLE');
  });
});

describe('createThrottle', () => {
  test('các lần bắt đầu cách nhau tối thiểu MIN_GAP_MS và chạy tuần tự', async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const t = createThrottle(MIN_GAP_MS, { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    const job = () => t.run(async () => void starts.push(Date.now()));
    const all = Promise.all([job(), job(), job()]);
    await vi.advanceTimersByTimeAsync(MIN_GAP_MS * 3);
    await all;
    expect(starts).toHaveLength(3);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(MIN_GAP_MS);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(MIN_GAP_MS);
  });

  test('tác vụ lỗi không chặn tác vụ sau', async () => {
    const t = createThrottle(0, { now: () => 0, sleep: async () => {} });
    await expect(t.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(t.run(async () => 7)).resolves.toBe(7);
  });
});
