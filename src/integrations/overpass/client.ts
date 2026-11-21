import 'server-only';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { AppError } from '@/shared/errors';

/** Overpass (OpenStreetMap): tìm quán/điểm theo loại quanh một tọa độ. Miễn phí, không cần khóa. */
const USER_AGENT = 'FoodTourNhom/1.0 (self-hosted group app)';
/** Tối đa ngần này kết quả mỗi lần, đủ một màn cuộn. */
export const OVERPASS_LIMIT = 60;
const TIMEOUT_SEC = 20;

/** Loại chỗ của app → điều kiện thẻ OSM (key, value). */
const CATEGORY_TAGS: Record<StoredPlaceCategory, [string, string][]> = {
  food: [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  snack: [['amenity', 'fast_food'], ['amenity', 'ice_cream'], ['shop', 'bakery'], ['shop', 'pastry']],
  cafe: [['amenity', 'cafe']],
  play: [['tourism', 'attraction'], ['tourism', 'museum'], ['tourism', 'viewpoint'], ['leisure', 'park']],
  stay: [['tourism', 'hotel'], ['tourism', 'guest_house'], ['tourism', 'hostel'], ['tourism', 'motel']],
  gift: [['shop', 'gift'], ['shop', 'confectionery'], ['shop', 'souvenir']],
};

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface NearbyPlace extends LatLngPoint {
  /** "node/123" | "way/456": ổn định để làm khóa. */
  osmId: string;
  name: string;
  address: string | null;
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(category: StoredPlaceCategory, at: LatLngPoint, radiusM: number): string {
  const around = `(around:${radiusM},${at.lat},${at.lng})`;
  const parts = CATEGORY_TAGS[category].map(([k, v]) => `nwr["${k}"="${v}"]["name"]${around};`).join('');
  return `[out:json][timeout:${TIMEOUT_SEC}];(${parts});out center ${OVERPASS_LIMIT};`;
}

export function toNearbyPlace(e: OsmElement): NearbyPlace | null {
  const name = e.tags?.name?.trim();
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (!name || lat === undefined || lng === undefined) return null;
  const t = e.tags ?? {};
  const address = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null;
  return { osmId: `${e.type}/${e.id}`, name, address, lat, lng };
}

export interface OverpassClient {
  around(category: StoredPlaceCategory, at: LatLngPoint, radiusM: number): Promise<NearbyPlace[]>;
}

const unavailable = () => new AppError('EXPLORE_UNAVAILABLE', 'Không tải được dữ liệu bản đồ, thử lại sau.');

export function createOverpassClient(opts: { url: string; fetchFn?: typeof fetch }): OverpassClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async around(category, at, radiusM) {
      let res: Response;
      try {
        res = await fetchFn(opts.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
          body: new URLSearchParams({ data: buildOverpassQuery(category, at, radiusM) }),
        });
      } catch {
        throw unavailable();
      }
      if (!res.ok) throw unavailable();
      let data: { elements?: OsmElement[] };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw unavailable();
      }
      return (data.elements ?? []).map(toNearbyPlace).filter((p): p is NearbyPlace => p !== null);
    },
  };
}
