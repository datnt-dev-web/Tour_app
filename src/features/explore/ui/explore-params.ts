import { EXPLORE_CATEGORIES } from '@/features/places/constants';
import type { PlaceCategory, PriceTier } from '@/integrations/google-places/types';

export interface ExploreParams {
  city: string;
  category: PlaceCategory;
  price?: PriceTier;
  /** Chuyến đang thêm chỗ vào (từ nút "Tìm thêm"); không ảnh hưởng kết quả tìm. */
  trip?: string;
}

export const DEFAULT_CATEGORY: PlaceCategory = 'food';

export function readParams(sp: URLSearchParams): ExploreParams {
  const raw = sp.get('category');
  const category = EXPLORE_CATEGORIES.find((c) => c === raw) ?? DEFAULT_CATEGORY;
  const price = Number(sp.get('price'));
  return {
    city: sp.get('city')?.trim() ?? '',
    category,
    price: price === 1 || price === 2 || price === 3 ? price : undefined,
    trip: sp.get('trip') || undefined,
  };
}

/** Query string mới từ params hiện tại + patch (patch có khóa `price: undefined` nghĩa là bỏ lọc giá). */
export function buildExploreQuery(current: ExploreParams, patch: Partial<ExploreParams>): string {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams();
  if (next.city) qs.set('city', next.city);
  qs.set('category', next.category);
  if (next.price) qs.set('price', String(next.price));
  if (next.trip) qs.set('trip', next.trip);
  return qs.toString();
}

/**
 * Quyết định có đồng bộ ô nhập từ URL không. URL mang đúng city ta vừa đẩy thì giữ ô nhập (người dùng có thể đã gõ tiếp);
 * ngược lại là điều hướng ngoài: lấy city từ URL và coi nó là mốc mới để lần back/forward sau không bị bỏ qua.
 */
export function syncCityFromUrl(urlCity: string, pushed: string): { input: string | null; pushed: string } {
  return urlCity === pushed ? { input: null, pushed } : { input: urlCity, pushed: urlCity };
}
