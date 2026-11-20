import type { GeminiClient } from '@/integrations/gemini/client';
import { parseHotPlaces, parsePlaceSummary, type HotSuggestion, type PlaceSummary } from '@/integrations/gemini/parse';
import { hotPrompt, summaryPrompt } from '@/integrations/gemini/prompts';
import type { PlaceCandidate, PlaceCategory, PlacesClient } from '@/integrations/google-places/types';
import { CATEGORY_LABELS } from '@/features/places/constants';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cacheKey } from '@/shared/cache/keys';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { normalizeText } from '@/shared/text';
import { consumeAiQuota, getAiStatus, refundAiQuota } from './quota';

export type { AiStatus } from './quota';
export { getAiStatus };

export interface HotPlace {
  name: string;
  address: string;
  reason: string;
  verified: boolean;
  candidate: PlaceCandidate | null;
}

export interface AiDeps {
  gemini: GeminiClient;
  places: Pick<PlacesClient, 'searchOne'>;
  /** Cache lâu dài (bảng ai_cache); chỉ cần get/set. */
  aiCache: Pick<CacheStore, 'get' | 'set'>;
  /** Bộ đếm quota (Redis). */
  quota: CacheStore;
  now?: () => Date;
}

export interface SummaryPlace {
  googlePlaceId: string;
  name: string;
  city: string;
  address: string;
}

/**
 * Chạy `fn` sau khi trừ 1 lượt. Lỗi nào sau đó (không dùng được, Gemini hỏng...) cũng hoàn lượt
 * và không cache; lỗi lạ được gói thành AI_UNAVAILABLE.
 */
async function withQuota<T>(deps: AiDeps, groupId: string, fn: (remainingToday: number) => Promise<T>): Promise<T> {
  const now = (deps.now ?? (() => new Date()))();
  const { remainingToday } = await consumeAiQuota(deps.quota, groupId, now);
  try {
    return await fn(remainingToday);
  } catch (e) {
    await refundAiQuota(deps.quota, groupId, now);
    if (e instanceof AppError) throw e;
    throw new AppError('AI_UNAVAILABLE', 'AI đang bận, thử lại sau.');
  }
}

export async function getPlaceSummary(deps: AiDeps, groupId: string, place: SummaryPlace): Promise<PlaceSummary & { remainingToday: number }> {
  const key = `ai:summary:${place.googlePlaceId}`;
  const hit = await deps.aiCache.get<PlaceSummary>(key);
  if (hit) return { ...hit, remainingToday: (await getAiStatus(deps.quota, groupId, deps.now?.())).remainingToday };

  return withQuota(deps, groupId, async (remainingToday) => {
    const { text, sources } = await deps.gemini.groundedJson(summaryPrompt(place));
    const summary = parsePlaceSummary(text, sources, deps.now?.());
    await deps.aiCache.set(key, summary, getEnv().AI_SUMMARY_TTL_SEC);
    return { ...summary, remainingToday };
  });
}

/** Quán đã xác minh khi Places trả chỗ có tên chứa/được chứa trong tên AI nêu; lỗi Places chỉ làm quán đó thành chưa xác minh. */
async function verify(places: AiDeps['places'], s: HotSuggestion, city: string): Promise<HotPlace> {
  let found: PlaceCandidate | null = null;
  try {
    found = await places.searchOne(`${s.name} ${s.address} ${city}`);
  } catch {
    found = null;
  }
  const a = normalizeText(s.name);
  const b = found ? normalizeText(found.name) : '';
  const candidate = found && (b.includes(a) || a.includes(b)) ? found : null;
  return { ...s, verified: candidate !== null, candidate };
}

export async function findHotPlaces(deps: AiDeps, groupId: string, p: { city: string; category: PlaceCategory }): Promise<HotPlace[]> {
  const key = cacheKey('ai:hot', { city: p.city, category: p.category });
  const hit = await deps.aiCache.get<HotPlace[]>(key);
  if (hit) return hit;

  return withQuota(deps, groupId, async () => {
    const { text } = await deps.gemini.groundedJson(hotPrompt({ city: p.city, categoryLabel: CATEGORY_LABELS[p.category] }));
    const suggestions = parseHotPlaces(text);
    const places = await Promise.all(suggestions.map((s) => verify(deps.places, s, p.city)));
    if (places.length > 0) await deps.aiCache.set(key, places, getEnv().AI_HOT_TTL_SEC);
    return places;
  });
}
