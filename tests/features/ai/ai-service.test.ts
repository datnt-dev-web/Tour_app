import { beforeEach, describe, expect, test, vi } from 'vitest';
import { findHotPlaces, getPlaceSummary, type AiDeps } from '@/features/ai/services/ai-service';
import type { GeminiClient } from '@/integrations/gemini/client';
import type { PlaceCandidate } from '@/integrations/google-places/types';
import { MemoryCacheStore } from '@/shared/cache/memory-store';
import { AppError } from '@/shared/errors';

vi.mock('@/shared/config/env', () => ({
  getEnv: () => ({ AI_DAILY_LIMIT_PER_GROUP: 10, AI_MONTHLY_CAP: 300, AI_SUMMARY_TTL_SEC: 60, AI_HOT_TTL_SEC: 60 }),
}));

const NOW = new Date('2026-11-20T05:00:00Z');
const place = { googlePlaceId: 'g1', name: 'Bánh bèo cô Mây', city: 'Hải Phòng', address: '1 Lạch Tray' };
const sources = [{ title: 'Threads', uri: 'https://example.test/a' }];
const json = (o: unknown) => `\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;
const candidate = (name: string): PlaceCandidate => ({
  googlePlaceId: `id-${name}`, name, address: 'x', rating: 4.5, reviewCount: 50, priceTier: 1, openNow: null, mapsUrl: 'u',
});

let quota: MemoryCacheStore;
let aiCache: MemoryCacheStore;
const groundedJson = vi.fn<GeminiClient['groundedJson']>();
const searchOne = vi.fn<(q: string) => Promise<PlaceCandidate | null>>();
const deps = (): AiDeps => ({ gemini: { groundedJson }, places: { searchOne }, aiCache, quota, now: () => NOW });

beforeEach(() => {
  quota = new MemoryCacheStore();
  aiCache = new MemoryCacheStore();
  groundedJson.mockReset();
  searchOne.mockReset();
});

describe('getPlaceSummary', () => {
  test('gọi Gemini, trừ 1 lượt và cache kết quả', async () => {
    groundedJson.mockResolvedValue({ text: json({ pros: ['ngon'] }), sources });
    const r = await getPlaceSummary(deps(), 'G', place);
    expect(r.pros).toEqual(['ngon']);
    expect(r.remainingToday).toBe(9);
    expect(await aiCache.get('ai:summary:g1')).not.toBeNull();
  });

  test('trúng cache không trừ lượt và không gọi Gemini', async () => {
    groundedJson.mockResolvedValue({ text: json({ pros: ['ngon'] }), sources });
    await getPlaceSummary(deps(), 'G', place);
    const r = await getPlaceSummary(deps(), 'G', place);
    expect(groundedJson).toHaveBeenCalledTimes(1);
    expect(r.remainingToday).toBe(9);
    expect(await quota.get('ai:day:G:2026-11-20')).toBe(1);
  });

  test('gặp AI_UNUSABLE thì hoàn lượt và không cache', async () => {
    groundedJson.mockResolvedValue({ text: 'không json', sources });
    await expect(getPlaceSummary(deps(), 'G', place)).rejects.toMatchObject({ code: 'AI_UNUSABLE' });
    expect(await quota.get('ai:day:G:2026-11-20')).toBe(0);
    expect(await aiCache.get('ai:summary:g1')).toBeNull();
  });

  test('Gemini lỗi thì hoàn lượt, AI_UNAVAILABLE, không cache', async () => {
    groundedJson.mockRejectedValue(new AppError('AI_UNAVAILABLE', 'bận'));
    await expect(getPlaceSummary(deps(), 'G', place)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    groundedJson.mockRejectedValue(new Error('boom'));
    await expect(getPlaceSummary(deps(), 'G', place)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(await quota.get('ai:day:G:2026-11-20')).toBe(0);
    expect(await aiCache.get('ai:summary:g1')).toBeNull();
  });

  test('hết lượt thì AI_QUOTA và không gọi Gemini', async () => {
    await quota.set('ai:day:G:2026-11-20', 10, 100);
    await expect(getPlaceSummary(deps(), 'G', place)).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect(groundedJson).not.toHaveBeenCalled();
  });
});

describe('findHotPlaces', () => {
  const hot = json({ places: [{ name: 'Bánh bèo cô Mây', address: 'a', reason: 'r1' }, { name: 'Quán ma', address: 'b', reason: 'r2' }] });

  test('đánh dấu verified/unverified theo searchOne', async () => {
    groundedJson.mockResolvedValue({ text: hot, sources });
    searchOne.mockImplementation(async (q) => (q.startsWith('Bánh bèo') ? candidate('Bánh Bèo Cô Mây - Lạch Tray') : null));
    const r = await findHotPlaces(deps(), 'G', { city: 'Hải Phòng', category: 'food' });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: 'Bánh bèo cô Mây', verified: true, candidate: { googlePlaceId: 'id-Bánh Bèo Cô Mây - Lạch Tray' } });
    expect(r[1]).toMatchObject({ name: 'Quán ma', verified: false, candidate: null });
    expect(searchOne).toHaveBeenCalledWith('Bánh bèo cô Mây a Hải Phòng');
  });

  test('searchOne trả tên không liên quan thì chưa xác minh', async () => {
    groundedJson.mockResolvedValue({ text: hot, sources });
    searchOne.mockResolvedValue(candidate('Nhà hàng khác'));
    const r = await findHotPlaces(deps(), 'G', { city: 'Hải Phòng', category: 'food' });
    expect(r.every((h) => !h.verified && h.candidate === null)).toBe(true);
  });

  test('searchOne lỗi thì quán đó chưa xác minh, không vỡ cả danh sách', async () => {
    groundedJson.mockResolvedValue({ text: hot, sources });
    searchOne.mockRejectedValue(new AppError('PLACES_UNAVAILABLE', 'down'));
    const r = await findHotPlaces(deps(), 'G', { city: 'Hải Phòng', category: 'food' });
    expect(r.map((h) => h.verified)).toEqual([false, false]);
  });

  test('cache theo thành phố+loại, lần 2 không trừ lượt', async () => {
    groundedJson.mockResolvedValue({ text: hot, sources });
    searchOne.mockResolvedValue(null);
    await findHotPlaces(deps(), 'G', { city: 'Hải Phòng', category: 'food' });
    await findHotPlaces(deps(), 'G', { city: 'hai phong', category: 'food' });
    expect(groundedJson).toHaveBeenCalledTimes(1);
    expect(await quota.get('ai:day:G:2026-11-20')).toBe(1);
  });

  test('AI_UNUSABLE hoàn lượt', async () => {
    groundedJson.mockResolvedValue({ text: 'xin lỗi', sources: [] });
    await expect(findHotPlaces(deps(), 'G', { city: 'Hà Nội', category: 'cafe' })).rejects.toMatchObject({ code: 'AI_UNUSABLE' });
    expect(await quota.get('ai:day:G:2026-11-20')).toBe(0);
  });
});
