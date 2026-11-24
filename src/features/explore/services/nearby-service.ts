import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import type { BookRow, BookVerdict } from '@/features/places/services/book-service';
import { distanceMeters } from '@/features/trips/services/geo';
import type { LatLngPoint, NearbyPlace, OverpassClient } from '@/integrations/overpass/client';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cached } from '@/shared/cache/cached';
import { cacheKey } from '@/shared/cache/keys';
import { AppError } from '@/shared/errors';
import { normalizeText } from '@/shared/text';

/** "Gần tôi": đi bộ / chạy xe ngắn. */
export const NEAR_ME_RADIUS_M = 1500;
/** Theo thành phố: quanh trung tâm. */
export const CITY_RADIUS_M = 4000;
/** Dữ liệu OSM ít đổi: cache một ngày. */
export const EXPLORE_TTL_SEC = 86_400;
/** Làm tròn tọa độ (~100 m) để những lần tìm sát nhau dùng chung cache. */
const COORD_DECIMALS = 3;

export interface ExploreDeps {
  osm: OverpassClient;
  geocoder: { geocode(q: string): Promise<LatLngPoint | null> };
  cache: CacheStore;
  ttlSec?: number;
}

export type ExploreNearbyPlace = NearbyPlace & { distanceM: number };

export interface ExploreNearbyResult {
  center: LatLngPoint;
  radiusM: number;
  places: ExploreNearbyPlace[];
}

const round = (n: number) => Number(n.toFixed(COORD_DECIMALS));

/** Quán/điểm trên OpenStreetMap quanh vị trí người dùng hoặc trung tâm thành phố, gần nhất trước. */
export async function exploreNearby(
  deps: ExploreDeps,
  input: { category: StoredPlaceCategory; at?: LatLngPoint; city?: string },
): Promise<ExploreNearbyResult> {
  const ttl = deps.ttlSec ?? EXPLORE_TTL_SEC;
  let center = input.at ?? null;
  if (!center && input.city) {
    const q = `${input.city.trim()}, Việt Nam`;
    center = await cached(deps.cache, cacheKey('explore:city', { q: normalizeText(q) }), ttl, () => deps.geocoder.geocode(q));
  }
  if (!center) throw new AppError('NOT_FOUND', 'Không tìm thấy thành phố này trên bản đồ.');

  const radiusM = input.at ? NEAR_ME_RADIUS_M : CITY_RADIUS_M;
  const at = { lat: round(center.lat), lng: round(center.lng) };
  const found = await cached(deps.cache, cacheKey('explore:osm', { c: input.category, lat: at.lat, lng: at.lng, r: radiusM }), ttl, () =>
    deps.osm.around(input.category, at, radiusM),
  );
  const places = found.map((p) => ({ ...p, distanceM: Math.round(distanceMeters(center, p)) })).sort((a, b) => a.distanceM - b.distanceM);
  return { center, radiusM, places };
}

const VERDICT_ORDER: Record<BookVerdict, number> = { up: 0, none: 1, down: 2 };

/** Chỗ trong Sổ quán của nhóm ở thành phố và loại đang xem: quán được khen trước, quán bị chê sau cùng. */
export function pickBookForExplore(rows: BookRow[], city: string, category: StoredPlaceCategory): BookRow[] {
  const cityKey = normalizeText(city);
  return rows.filter((r) => r.cityKey === cityKey && r.category === category).sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]);
}
