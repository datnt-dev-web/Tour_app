import 'server-only';
import type { LatLng } from '@/integrations/google-places/types';
import { AppError } from '@/shared/errors';

const BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GeocodingClient {
  /** null khi Google không tìm thấy địa chỉ (ZERO_RESULTS). */
  geocode(address: string): Promise<LatLng | null>;
}

interface RawGeocode {
  status?: string;
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
}

export function createGeocodingClient(apiKey: string): GeocodingClient {
  return {
    async geocode(address) {
      const url = `${BASE_URL}?${new URLSearchParams({ address, region: 'vn', language: 'vi', key: apiKey })}`;
      // Không đưa lỗi gốc vào message: nó có thể chứa URL/key.
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        throw new AppError('PLACES_UNAVAILABLE', 'Không kết nối được Google Geocoding, thử lại sau.');
      }
      if (!res.ok) throw new AppError('PLACES_UNAVAILABLE', `Google Geocoding tạm thời không khả dụng (${res.status}).`);
      let data: RawGeocode;
      try {
        data = (await res.json()) as RawGeocode;
      } catch {
        throw new AppError('PLACES_UNAVAILABLE', 'Google Geocoding trả về dữ liệu không hợp lệ.');
      }
      if (data.status === 'ZERO_RESULTS') return null;
      const loc = data.results?.[0]?.geometry?.location;
      if (data.status !== 'OK' || typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') {
        throw new AppError('PLACES_UNAVAILABLE', `Google Geocoding không khả dụng (${data.status ?? 'không rõ'}).`);
      }
      return { lat: loc.lat, lng: loc.lng };
    },
  };
}
