import type { GeocodingClient } from '@/integrations/nominatim/client';
import type { LatLng, PlacesClient } from '@/integrations/google-places/types';
import type { Place } from '@/features/places/repositories/places-repo';
import { hasRealAddress, placeKeyOf } from '@/features/places/constants';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cached } from '@/shared/cache/cached';
import { cacheKey } from '@/shared/cache/keys';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import type { TripPlaceStatus, TripsRepo } from '../repositories/trips-repo';

export interface TripMapPoint {
  tripPlaceId: string;
  placeKey: string;
  name: string;
  address: string;
  status: TripPlaceStatus;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
}

export interface TripLocations {
  points: TripMapPoint[];
  /** Số chỗ không định vị được (không tìm thấy, hoặc dịch vụ định vị lỗi). */
  missing: number;
}

export interface TripLocationsDeps {
  places: Pick<PlacesClient, 'getDetails'>;
  geocoder: GeocodingClient;
  /** Khóa Google Places dùng được; false thì bỏ qua Google hoàn toàn. */
  googleEnabled: boolean;
  cache: CacheStore;
  tripsRepo: Pick<TripsRepo, 'getTripDetail'>;
}

/** Geocode OSM một chuỗi truy vấn; chỉ cache kết quả có tọa độ (null không bao giờ được cache). */
const geocodeCached = (deps: TripLocationsDeps, q: string) =>
  cached(deps.cache, cacheKey('geo:osm', { q }), getEnv().GEOCODE_TTL_SEC, () => deps.geocoder.geocode(q), {
    shouldCache: (v) => v !== null,
  });

/** Tọa độ chỉ nằm ở cache Redis, không ghi vào DB. Thứ tự: Google Details (nếu bật), rồi OSM theo địa chỉ, rồi theo tên. */
async function locate(deps: TripLocationsDeps, place: Place, city: string): Promise<LatLng | null> {
  if (deps.googleEnabled && place.google_place_id) {
    const id = place.google_place_id;
    const details = await cached(deps.cache, cacheKey('places:details', { id }), getEnv().PLACES_TTL_SEC, () => deps.places.getDetails(id));
    if (details.location) return details.location;
  }
  if (hasRealAddress(place.address)) {
    const hit = await geocodeCached(deps, `${place.address.trim()}, ${city}, Việt Nam`);
    if (hit) return hit;
  }
  return geocodeCached(deps, `${place.name.trim()}, ${city}, Việt Nam`);
}

/** Chỗ của chuyến (trừ dropped) kèm tọa độ. Lỗi từng chỗ không làm hỏng cả kết quả. Chuyến không thuộc nhóm hoặc không thấy được: NOT_FOUND. */
export async function getTripLocations(deps: TripLocationsDeps, groupId: string, tripId: string): Promise<TripLocations> {
  const detail = await deps.tripsRepo.getTripDetail(tripId);
  if (!detail || detail.trip.group_id !== groupId) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');

  const items = detail.items.filter((i) => i.status !== 'dropped');
  const results = await Promise.allSettled(items.map((i) => locate(deps, i.place, detail.trip.city)));
  const points: TripMapPoint[] = [];
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled' || !r.value) return;
    const item = items[idx];
    points.push({
      tripPlaceId: item.id,
      placeKey: placeKeyOf({ placeId: item.place.id, googlePlaceId: item.place.google_place_id }),
      name: item.place.name,
      address: item.place.address ?? '',
      status: item.status,
      lat: r.value.lat,
      lng: r.value.lng,
      googlePlaceId: item.place.google_place_id,
    });
  });
  return { points, missing: items.length - points.length };
}
