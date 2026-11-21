import { describe, expect, test } from 'vitest';
import { addressDirectionsUrl, directionsUrl, parseTripView, placeDetailHref, tripViewHref } from '@/features/trips/ui/trip-view';

describe('parseTripView', () => {
  test('map/timeline chỉ khi đúng giá trị', () => {
    expect(parseTripView('map')).toBe('map');
    expect(parseTripView('timeline')).toBe('timeline');
    expect(parseTripView('stats')).toBe('stats');
    expect(parseTripView('list')).toBe('list');
    expect(parseTripView('MAP')).toBe('list');
    expect(parseTripView(null)).toBe('list');
    expect(parseTripView(undefined)).toBe('list');
  });
});

describe('tripViewHref', () => {
  test('map giữ ?view=map, danh sách bỏ query', () => {
    expect(tripViewHref('/trips/t1', 'map')).toBe('/trips/t1?view=map');
    expect(tripViewHref('/trips/t1', 'timeline')).toBe('/trips/t1?view=timeline');
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

describe('addressDirectionsUrl', () => {
  const place = { name: 'Nem cua bể Quán Nga', address: '92 Trần Nhật Duật', city: 'Hải Phòng', google_place_id: null };
  test('tên + địa chỉ + thành phố', () => {
    const url = new URL(addressDirectionsUrl(place)!);
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('Nem cua bể Quán Nga, 92 Trần Nhật Duật, Hải Phòng');
    expect(url.searchParams.has('destination_place_id')).toBe(false);
  });
  test('địa chỉ đã có thành phố thì không lặp; có Google id thì kèm', () => {
    const url = new URL(addressDirectionsUrl({ ...place, address: 'Lạch Tray, Gia Viên, Hải Phòng', google_place_id: 'ChIJx' })!);
    expect(url.searchParams.get('destination')).toBe('Nem cua bể Quán Nga, Lạch Tray, Gia Viên, Hải Phòng');
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJx');
  });
  test('không có địa chỉ thật thì null', () => {
    expect(addressDirectionsUrl({ ...place, address: null })).toBeNull();
    expect(addressDirectionsUrl({ ...place, address: '  ' })).toBeNull();
    expect(addressDirectionsUrl({ ...place, address: '(chưa chọn quán)' })).toBeNull();
  });
});
