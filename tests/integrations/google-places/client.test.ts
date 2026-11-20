import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppError } from '@/shared/errors';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { CATEGORY_QUERY, mapPriceLevel, priceTierToLevels } from '@/integrations/google-places/mapping';

const KEY = 'secret-key-123';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('mapping', () => {
  test('mapPriceLevel', () => {
    expect(mapPriceLevel('PRICE_LEVEL_FREE')).toBe(1);
    expect(mapPriceLevel('PRICE_LEVEL_INEXPENSIVE')).toBe(1);
    expect(mapPriceLevel('PRICE_LEVEL_MODERATE')).toBe(2);
    expect(mapPriceLevel('PRICE_LEVEL_EXPENSIVE')).toBe(3);
    expect(mapPriceLevel('PRICE_LEVEL_VERY_EXPENSIVE')).toBe(3);
    expect(mapPriceLevel(undefined)).toBeNull();
    expect(priceTierToLevels(1)).toEqual(['PRICE_LEVEL_INEXPENSIVE']);
    expect(priceTierToLevels(2)).toEqual(['PRICE_LEVEL_MODERATE']);
    expect(priceTierToLevels(3)).toEqual(['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']);
  });
  test('CATEGORY_QUERY', () => {
    expect(CATEGORY_QUERY.food.textQuery('Huế')).toBe('quán ăn ngon ở Huế');
    expect(CATEGORY_QUERY.food.includedType).toBe('restaurant');
    expect(CATEGORY_QUERY.snack.includedType).toBeUndefined();
    expect(CATEGORY_QUERY.stay.includedType).toBe('lodging');
  });
});

describe('searchText', () => {
  test('gửi đúng header, field mask, body', async () => {
    const fetchMock = mockFetch({ places: [] });
    await createGooglePlacesClient(KEY).searchText({ city: 'Đà Lạt', category: 'cafe', priceTiers: [1, 2] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe(KEY);
    expect(init.headers['X-Goog-FieldMask']).toContain('places.userRatingCount');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      textQuery: 'cà phê ở Đà Lạt',
      includedType: 'cafe',
      pageSize: 20,
      languageCode: 'vi',
      regionCode: 'VN',
    });
    expect(body.priceLevels).toEqual(['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE']);
  });

  test('map response sang PlaceCandidate', async () => {
    mockFetch({
      places: [
        {
          id: 'p1',
          displayName: { text: 'Chè Hường' },
          formattedAddress: '1 Phố A',
          rating: 4.6,
          userRatingCount: 2100,
          priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
          currentOpeningHours: { openNow: true },
          googleMapsUri: 'https://maps.google.com/?cid=1',
        },
      ],
    });
    const [p] = await createGooglePlacesClient(KEY).searchText({ city: 'Hà Nội', category: 'snack' });
    expect(p).toEqual({
      googlePlaceId: 'p1',
      name: 'Chè Hường',
      address: '1 Phố A',
      rating: 4.6,
      reviewCount: 2100,
      priceTier: 1,
      openNow: true,
      mapsUrl: 'https://maps.google.com/?cid=1',
    });
  });

  test('thiếu rating/userRatingCount → rating null, reviewCount 0', async () => {
    mockFetch({ places: [{ id: 'p2', displayName: { text: 'X' } }] });
    const [p] = await createGooglePlacesClient(KEY).searchText({ city: 'Huế', category: 'food' });
    expect(p.rating).toBeNull();
    expect(p.reviewCount).toBe(0);
    expect(p.priceTier).toBeNull();
    expect(p.openNow).toBeNull();
  });

  test('response không có places → []', async () => {
    mockFetch({});
    expect(await createGooglePlacesClient(KEY).searchText({ city: 'Huế', category: 'food' })).toEqual([]);
  });

  test.each([429, 403, 500])('HTTP %i → PLACES_UNAVAILABLE, không lộ key', async (status) => {
    mockFetch({ error: 'x' }, status);
    const err = await createGooglePlacesClient(KEY)
      .searchText({ city: 'Huế', category: 'food' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('PLACES_UNAVAILABLE');
    expect(err.message).not.toContain(KEY);
  });

  test('200 + body không phải JSON → PLACES_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>oops', { status: 200 })));
    await expect(createGooglePlacesClient(KEY).searchText({ city: 'Huế', category: 'food' })).rejects.toMatchObject({
      code: 'PLACES_UNAVAILABLE',
    });
  });

  test('200 + body null → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));
    expect(await createGooglePlacesClient(KEY).searchText({ city: 'Huế', category: 'food' })).toEqual([]);
  });

  test('lỗi mạng → PLACES_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`boom ${KEY}`)));
    const err = await createGooglePlacesClient(KEY)
      .searchText({ city: 'Huế', category: 'food' })
      .catch((e) => e);
    expect(err.code).toBe('PLACES_UNAVAILABLE');
    expect(err.message).not.toContain(KEY);
  });
});

describe('searchOne', () => {
  test('pageSize 1, trả kết quả đầu hoặc null', async () => {
    const fetchMock = mockFetch({ places: [{ id: 'a', displayName: { text: 'A' } }] });
    const r = await createGooglePlacesClient(KEY).searchOne('Phở Thìn');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ textQuery: 'Phở Thìn', pageSize: 1 });
    expect(r?.googlePlaceId).toBe('a');
    mockFetch({});
    expect(await createGooglePlacesClient(KEY).searchOne('zzz')).toBeNull();
  });
});

describe('getDetails', () => {
  test('GET details với field mask và languageCode', async () => {
    const fetchMock = mockFetch({
      id: 'p1',
      displayName: { text: 'A' },
      regularOpeningHours: { weekdayDescriptions: ['Thứ Hai: 7:00–22:00'] },
      nationalPhoneNumber: '024 1234',
    });
    const d = await createGooglePlacesClient(KEY).getDetails('p1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places/p1?languageCode=vi');
    expect(init.headers['X-Goog-FieldMask']).toContain('regularOpeningHours.weekdayDescriptions');
    expect(init.headers['X-Goog-FieldMask']).not.toContain('places.');
    expect(d.weekdayHours).toEqual(['Thứ Hai: 7:00–22:00']);
    expect(d.phone).toBe('024 1234');
  });

  test('location: map tọa độ, thiếu thì null', async () => {
    const fetchMock = mockFetch({ id: 'p1', displayName: { text: 'A' }, location: { latitude: 20.85, longitude: 106.68 } });
    const d = await createGooglePlacesClient(KEY).getDetails('p1');
    expect(fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('location');
    expect(d.location).toEqual({ lat: 20.85, lng: 106.68 });
    mockFetch({ id: 'p1', displayName: { text: 'A' } });
    expect((await createGooglePlacesClient(KEY).getDetails('p1')).location).toBeNull();
  });

  test('thiếu giờ/điện thoại → [] / null', async () => {
    mockFetch({ id: 'p1', displayName: { text: 'A' } });
    const d = await createGooglePlacesClient(KEY).getDetails('p1');
    expect(d.weekdayHours).toEqual([]);
    expect(d.phone).toBeNull();
  });

  test('id có "/" được URL-encode', async () => {
    const fetchMock = mockFetch({ id: 'a/b', displayName: { text: 'A' } });
    await createGooglePlacesClient(KEY).getDetails('a/b');
    expect(fetchMock.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/a%2Fb?languageCode=vi');
  });

  test('200 + body null → PLACES_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));
    await expect(createGooglePlacesClient(KEY).getDetails('p1')).rejects.toMatchObject({ code: 'PLACES_UNAVAILABLE' });
  });

  test('HTTP 403 → PLACES_UNAVAILABLE', async () => {
    mockFetch({}, 403);
    await expect(createGooglePlacesClient(KEY).getDetails('p1')).rejects.toMatchObject({ code: 'PLACES_UNAVAILABLE' });
  });
});
