import { afterEach, describe, expect, test, vi } from 'vitest';
import { createGeocodingClient } from '@/integrations/google-geocoding/client';
import { AppError } from '@/shared/errors';

const KEY = 'secret-key-123';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('geocode', () => {
  test('gửi đúng URL và tham số', async () => {
    const fetchMock = mockFetch({ status: 'OK', results: [{ geometry: { location: { lat: 1, lng: 2 } } }] });
    await createGeocodingClient(KEY).geocode('12 Lạch Tray, Hải Phòng');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url.searchParams.get('address')).toBe('12 Lạch Tray, Hải Phòng');
    expect(url.searchParams.get('region')).toBe('vn');
    expect(url.searchParams.get('language')).toBe('vi');
    expect(url.searchParams.get('key')).toBe(KEY);
  });

  test('OK trả tọa độ', async () => {
    mockFetch({ status: 'OK', results: [{ geometry: { location: { lat: 20.85, lng: 106.68 } } }] });
    expect(await createGeocodingClient(KEY).geocode('x')).toEqual({ lat: 20.85, lng: 106.68 });
  });

  test('ZERO_RESULTS trả null', async () => {
    mockFetch({ status: 'ZERO_RESULTS', results: [] });
    expect(await createGeocodingClient(KEY).geocode('x')).toBeNull();
  });

  test('HTTP lỗi ném PLACES_UNAVAILABLE, message không chứa khóa', async () => {
    mockFetch({}, 500);
    const err = await createGeocodingClient(KEY).geocode('x').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('PLACES_UNAVAILABLE');
    expect(err.message).not.toContain(KEY);
  });

  test('status REQUEST_DENIED ném PLACES_UNAVAILABLE', async () => {
    mockFetch({ status: 'REQUEST_DENIED', error_message: `bad key ${KEY}` });
    const err = await createGeocodingClient(KEY).geocode('x').catch((e) => e);
    expect(err.code).toBe('PLACES_UNAVAILABLE');
    expect(err.message).not.toContain(KEY);
  });

  test('lỗi mạng không lộ khóa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`fail https://x?key=${KEY}`)));
    const err = await createGeocodingClient(KEY).geocode('x').catch((e) => e);
    expect(err.code).toBe('PLACES_UNAVAILABLE');
    expect(err.message).not.toContain(KEY);
  });
});
