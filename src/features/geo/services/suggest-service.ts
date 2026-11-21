import { SUGGEST_LIMIT, type GeoSuggestion, type SuggestClient, type SuggestKind } from '@/integrations/photon/client';
import { cached } from '@/shared/cache/cached';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cacheKey } from '@/shared/cache/keys';
import { normalizeText } from '@/shared/text';
import { MIN_SUGGEST_CHARS } from '../constants';

/**
 * Gợi ý địa chỉ/thành phố, cache theo truy vấn đã chuẩn hóa. Có `city` (thành phố của chuyến) thì
 * đưa địa chỉ trong thành phố đó lên đầu, vì nhóm hầu như chỉ nhập quán ở nơi đang đi.
 */
export async function suggestPlaces(
  deps: { client: SuggestClient; cache: CacheStore; ttlSec: number },
  input: { q: string; kind: SuggestKind; city?: string },
): Promise<GeoSuggestion[]> {
  const q = input.q.trim();
  if (q.length < MIN_SUGGEST_CHARS) return [];
  const all = await cached(deps.cache, cacheKey('geo:suggest', { q, kind: input.kind }), deps.ttlSec, () => deps.client.suggest(q, input.kind));
  const city = input.city ? normalizeText(input.city) : '';
  const inCity = (s: GeoSuggestion) => !!city && !!s.city && normalizeText(s.city) === city;
  return [...all.filter(inCity), ...all.filter((s) => !inCity(s))].slice(0, SUGGEST_LIMIT);
}
