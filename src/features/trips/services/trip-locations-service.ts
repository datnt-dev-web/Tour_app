import type { GeocodingClient } from '@/integrations/google-geocoding/client';
import type { LatLng, PlacesClient } from '@/integrations/google-places/types';
import type { Place } from '@/features/places/repositories/places-repo';
import { placeKeyOf } from '@/features/places/constants';
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
  /** Số chỗ không định vị được (thiếu địa chỉ, hoặc Google lỗi / không tìm thấy). */
  missing: number;
}

export interface TripLocationsDeps {
  places: Pick<PlacesClient, 'getDetails'>;
  geocoder: GeocodingClient;
  cache: CacheStore;
  tripsRepo: Pick<TripsRepo, 'getTripDetail'>;
}

/** Địa chỉ dạng "(chưa rõ)" là chữ giữ chỗ, không geocode được. */
function usableAddress(address: string | null): address is string {
  const a = address?.trim();
  return !!a && !a.startsWith('(');
}

/** Tọa độ chỉ nằm ở cache Redis (điều khoản Google không cho lưu vào DB). Không định vị được thì null. */
async function locate(deps: TripLocationsDeps, place: Place, city: string): Promise<LatLng | null> {
  const ttl = getEnv().PLACES_TTL_SEC;
  if (place.google_place_id) {
    const id = place.google_place_id;
    const details = await cached(deps.cache, cacheKey('places:details', { id }), ttl, () => deps.places.getDetails(id));
    if (details.location) return details.location;
  }
  if (!usableAddress(place.address)) return null;
  const q = `${place.address.trim()}, ${city}`;
  // null (không tìm thấy) không được cache, theo hợp đồng của cached().
  return cached(deps.cache, cacheKey('geocode:address', { q }), ttl, () => deps.geocoder.geocode(q), {
    shouldCache: (v) => v !== null,
  });
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
