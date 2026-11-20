import { describe, expect, test } from 'vitest';
import { directionsUrl, parseTripView, placeDetailHref, tripViewHref } from '@/features/trips/ui/trip-view';

describe('parseTripView', () => {
  test('map chỉ khi đúng "map"', () => {
    expect(parseTripView('map')).toBe('map');
    expect(parseTripView('list')).toBe('list');
    expect(parseTripView('MAP')).toBe('list');
    expect(parseTripView(null)).toBe('list');
    expect(parseTripView(undefined)).toBe('list');
  });
});

describe('tripViewHref', () => {
  test('map giữ ?view=map, danh sách bỏ query', () => {
    expect(tripViewHref('/trips/t1', 'map')).toBe('/trips/t1?view=map');
    expect(tripViewHref('/trips/t1', 'list')).toBe('/trips/t1');
  });
});

describe('directionsUrl', () => {
  test('chỉ có tọa độ', () => {
    expect(directionsUrl({ lat: 20.85, lng: 106.68, googlePlaceId: null })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=20.85%2C106.68',
    );
  });
  test('kèm destination_place_id khi có', () => {
    const url = new URL(directionsUrl({ lat: 1, lng: 2, googlePlaceId: 'ChIJabc' }));
    expect(url.searchParams.get('destination')).toBe('1,2');
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJabc');
  });
});

describe('placeDetailHref', () => {
  test('mã hóa placeKey', () => {
    expect(placeDetailHref({ placeKey: 'local:abc' }, 't1')).toBe('/places/local%3Aabc?trip=t1');
  });
});
