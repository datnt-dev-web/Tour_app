import 'server-only';
import { AppError } from '@/shared/errors';

/**
 * Photon (komoot, dữ liệu OpenStreetMap) dành cho gợi ý khi gõ; Nominatim cấm dùng kiểu này.
 * Chỉ lấy kết quả ở Việt Nam: khung bao lãnh thổ để Photon ưu tiên, rồi lọc lại theo countrycode.
 */
const BASE_URL = 'https://photon.komoot.io/api/';
// Cố ý chung chung, không chứa thông tin cá nhân.
const USER_AGENT = 'FoodTourNhom/1.0 (self-hosted group app)';
const VN_BBOX = '102.1,8.2,109.5,23.4';
// Lấy dư rồi lọc VN và bỏ trùng; trả về tối đa SUGGEST_LIMIT.
const FETCH_LIMIT = 10;
export const SUGGEST_LIMIT = 5;

export type SuggestKind = 'address' | 'city';

export interface GeoSuggestion {
  /** Dòng hiển thị và giá trị điền vào ô, ví dụ "Phố Cầu Đất, Gia Viên, Hải Phòng". */
  label: string;
  name: string;
  /** Thành phố/tỉnh chứa điểm này (với kind=city là chính nó). */
  city: string | null;
}

export interface SuggestClient {
  suggest(q: string, kind: SuggestKind): Promise<GeoSuggestion[]>;
}

interface PhotonFeature {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

/** Bỏ phần rỗng và phần lặp lại (Photon hay trả name trùng city/street). */
const join = (parts: (string | undefined)[]) => [...new Set(parts.filter((p): p is string => !!p?.trim()))].join(', ');

export function toSuggestion(f: PhotonFeature, kind: SuggestKind): GeoSuggestion | null {
  const p = f.properties;
  if (p.countrycode !== 'VN') return null;
  if (kind === 'city') {
    if (!p.name) return null;
    return { label: join([p.name, p.state]), name: p.name, city: p.name };
  }
  const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const name = p.name ?? street;
  if (!name) return null;
  const city = p.city ?? p.state ?? null;
  return { label: join([name, name === street ? undefined : street, p.district ?? p.locality, city ?? undefined]), name, city };
}

const unavailable = () => new AppError('GEO_UNAVAILABLE', 'Không lấy được gợi ý địa chỉ, thử lại sau.');

export function createPhotonClient(): SuggestClient {
  return {
    async suggest(q, kind) {
      const params = new URLSearchParams({ q, limit: String(FETCH_LIMIT), bbox: VN_BBOX });
      // Thành phố: chỉ lấy tầng city/state (tỉnh) để không lẫn tên phố.
      if (kind === 'city') ['city', 'state'].forEach((l) => params.append('layer', l));
      let res: Response;
      try {
        res = await fetch(`${BASE_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
      } catch {
        throw unavailable();
      }
      if (!res.ok) throw unavailable();
      let data: { features?: PhotonFeature[] };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw unavailable();
      }
      const seen = new Set<string>();
      const out: GeoSuggestion[] = [];
      for (const f of data.features ?? []) {
        const s = toSuggestion(f, kind);
        if (!s || seen.has(s.label)) continue;
        seen.add(s.label);
        out.push(s);
      }
      return out;
    },
  };
}
