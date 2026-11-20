import type { PlaceCandidate, PlaceCategory, PlacesClient, PriceTier } from '@/integrations/google-places/types';
import { cached } from '@/shared/cache/cached';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cacheKey } from '@/shared/cache/keys';
import { getEnv } from '@/shared/config/env';
import { rankPlaces, type RankedPlace } from './ranking';

export interface ExploreParams {
  city: string;
  category: PlaceCategory;
  priceTier?: PriceTier;
  minReviews?: number;
}

/** Cache danh sách thô từ Places; xếp hạng chạy sau nên đổi minReviews không tốn thêm lượt gọi API. */
export async function exploreSearch(
  deps: { places: PlacesClient; cache: CacheStore },
  p: ExploreParams,
): Promise<RankedPlace[]> {
  const env = getEnv();
  const candidates = await cached<PlaceCandidate[]>(
    deps.cache,
    cacheKey('places:search', { city: p.city, category: p.category, price: p.priceTier }),
    env.PLACES_TTL_SEC,
    () =>
      deps.places.searchText({
        city: p.city,
        category: p.category,
        ...(p.priceTier ? { priceTiers: [p.priceTier] } : {}),
      }),
    { shouldCache: (v) => v.length > 0 },
  );
  return rankPlaces(candidates, { m: env.RANK_PRIOR_M, minReviews: p.minReviews ?? env.EXPLORE_MIN_REVIEWS });
}
