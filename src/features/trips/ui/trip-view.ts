import { hasRealAddress } from '@/features/places/constants';
import { TAB_STATUSES, type TripTab } from '../constants';
import type { StopsFilter } from './use-paged-stops';
import type { Place } from '@/features/places/repositories/places-repo';
import { normalizeText } from '@/shared/text';
import type { TripMapPoint } from '../services/trip-locations-service';

export type TripView = 'today' | 'list' | 'timeline' | 'map' | 'stats';

/** 'today' chỉ hiện khi chuyến đang diễn ra (xem visibleTripViews). */
export const TRIP_VIEWS: { value: TripView; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'list', label: 'Danh sách' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'map', label: 'Bản đồ' },
  { value: 'stats', label: 'Thống kê' },
];

/** Các tab hiện ra: bỏ "Hôm nay" khi chuyến chưa bắt đầu hoặc đã xong. */
export const visibleTripViews = (ongoing: boolean) => TRIP_VIEWS.filter((v) => ongoing || v.value !== 'today');

/** Giá trị lạ hoặc thiếu coi là danh sách. */
export function parseTripView(raw: string | null | undefined): TripView {
  return TRIP_VIEWS.find((v) => v.value === raw)?.value ?? 'list';
}

/** Danh sách là mặc định nên không cần query; view khác giữ `?view=` để back/forward và link trực tiếp hoạt động. */
export function tripViewHref(pathname: string, view: TripView): string {
  return view === 'list' ? pathname : `${pathname}?view=${view}`;
}

/** Mở Google Maps chỉ đường tới chỗ; kèm place id khi có để Google khớp đúng địa điểm. */
export function directionsUrl(p: Pick<TripMapPoint, 'lat' | 'lng' | 'googlePlaceId'>): string {
  const qs = new URLSearchParams({ api: '1', destination: `${p.lat},${p.lng}` });
  if (p.googlePlaceId) qs.set('destination_place_id', p.googlePlaceId);
  return `https://www.google.com/maps/dir/?${qs}`;
}

/**
 * Chỉ đường Google Maps theo tên + địa chỉ (cho thẻ chưa có tọa độ trong tay); kèm place id khi có để Google khớp đúng quán.
 * null khi chỗ chưa có địa chỉ thật.
 */
export function addressDirectionsUrl(p: Pick<Place, 'name' | 'address' | 'city' | 'google_place_id'>): string | null {
  if (!hasRealAddress(p.address)) return null;
  // Địa chỉ chọn từ gợi ý thường đã có tên thành phố; chỉ thêm khi thiếu.
  const withCity = normalizeText(p.address).includes(normalizeText(p.city)) ? p.address : `${p.address}, ${p.city}`;
  const qs = new URLSearchParams({ api: '1', destination: `${p.name}, ${withCity}` });
  if (p.google_place_id) qs.set('destination_place_id', p.google_place_id);
  return `https://www.google.com/maps/dir/?${qs}`;
}

export const placeDetailHref = (p: Pick<TripMapPoint, 'placeKey'>, tripId: string) =>
  `/places/${encodeURIComponent(p.placeKey)}?trip=${tripId}`;

/** Bộ lọc danh sách chỗ của từng tab: Danh sách gom theo loại; Timeline và giá từng chỗ theo lịch. */
export function stopsFilter(view: Exclude<TripView, 'map' | 'today'>, tab: TripTab, day = 'all'): StopsFilter {
  return {
    order: view === 'list' ? 'category' : 'schedule',
    statuses: TAB_STATUSES[view === 'stats' ? 'all' : tab],
    day: view === 'timeline' ? day : 'all',
  };
}
