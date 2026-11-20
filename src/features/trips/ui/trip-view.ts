import type { TripMapPoint } from '../services/trip-locations-service';

export type TripView = 'list' | 'map';

export const TRIP_VIEWS: { value: TripView; label: string }[] = [
  { value: 'list', label: 'Danh sách' },
  { value: 'map', label: 'Bản đồ' },
];

/** Giá trị lạ hoặc thiếu coi là danh sách. */
export function parseTripView(raw: string | null | undefined): TripView {
  return raw === 'map' ? 'map' : 'list';
}

/** Danh sách là mặc định nên không cần query; map giữ `?view=map` để back/forward và link trực tiếp hoạt động. */
export function tripViewHref(pathname: string, view: TripView): string {
  return view === 'map' ? `${pathname}?view=map` : pathname;
}

/** Mở Google Maps chỉ đường tới chỗ; kèm place id khi có để Google khớp đúng địa điểm. */
export function directionsUrl(p: Pick<TripMapPoint, 'lat' | 'lng' | 'googlePlaceId'>): string {
  const qs = new URLSearchParams({ api: '1', destination: `${p.lat},${p.lng}` });
  if (p.googlePlaceId) qs.set('destination_place_id', p.googlePlaceId);
  return `https://www.google.com/maps/dir/?${qs}`;
}

export const placeDetailHref = (p: Pick<TripMapPoint, 'placeKey'>, tripId: string) =>
  `/places/${encodeURIComponent(p.placeKey)}?trip=${tripId}`;
