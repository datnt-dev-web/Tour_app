import { describe, expect, test, vi } from 'vitest';
import { exploreSearch } from '@/features/explore/services/explore-service';
import { MemoryCacheStore } from '@/shared/cache/memory-store';
import { AppError } from '@/shared/errors';
import type { PlaceCandidate, PlacesClient } from '@/integrations/google-places/types';

vi.mock('@/shared/config/env', () => ({ getEnv: () => ({ PLACES_TTL_SEC: 60, RANK_PRIOR_M: 50, EXPLORE_MIN_REVIEWS: 20 }) }));

const place = (id: string, rating: number, reviewCount: number): PlaceCandidate => ({
  googlePlaceId: id, name: id, address: 'x', rating, reviewCount, priceTier: 1, openNow: null, mapsUrl: 'u',
});

function setup(result: PlaceCandidate[] | Error) {
  const searchText = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const places = { searchText } as unknown as PlacesClient;
  return { searchText, deps: { places, cache: new MemoryCacheStore() } };
}

describe('exploreSearch', () => {
  test('gọi Places 1 lần cho 2 lần tìm cùng key (khác cách gõ)', async () => {
    const { searchText, deps } = setup([place('a', 4.5, 100)]);
    await exploreSearch(deps, { city: 'Hải Phòng', category: 'food' });
    await exploreSearch(deps, { city: 'hai phong', category: 'food' });
    expect(searchText).toHaveBeenCalledTimes(1);
  });

  test('không cache kết quả rỗng', async () => {
    const { searchText, deps } = setup([]);
    await exploreSearch(deps, { city: 'Hải Phòng', category: 'food' });
    await exploreSearch(deps, { city: 'Hải Phòng', category: 'food' });
    expect(searchText).toHaveBeenCalledTimes(2);
  });

  test('lỗi Places lan ra AppError PLACES_UNAVAILABLE và không cache', async () => {
    const { searchText, deps } = setup(new AppError('PLACES_UNAVAILABLE', 'down'));
    await expect(exploreSearch(deps, { city: 'Hà Nội', category: 'cafe' })).rejects.toMatchObject({ code: 'PLACES_UNAVAILABLE' });
    await expect(exploreSearch(deps, { city: 'Hà Nội', category: 'cafe' })).rejects.toBeInstanceOf(AppError);
    expect(searchText).toHaveBeenCalledTimes(2);
  });

  test('đổi minReviews dùng lại cache', async () => {
    const { searchText, deps } = setup([place('a', 4.5, 100), place('b', 4.8, 25)]);
    const p = { city: 'Hải Phòng', category: 'food' as const };
    expect(await exploreSearch(deps, { ...p, minReviews: 20 })).toHaveLength(2);
    expect(await exploreSearch(deps, { ...p, minReviews: 50 })).toHaveLength(1);
    expect(searchText).toHaveBeenCalledTimes(1);
  });

  test('truyền priceTier xuống Places và tách cache theo giá', async () => {
    const { searchText, deps } = setup([place('a', 4.5, 100)]);
    await exploreSearch(deps, { city: 'Hải Phòng', category: 'food', priceTier: 2 });
    await exploreSearch(deps, { city: 'Hải Phòng', category: 'food' });
    expect(searchText).toHaveBeenNthCalledWith(1, { city: 'Hải Phòng', category: 'food', priceTiers: [2] });
    expect(searchText).toHaveBeenCalledTimes(2);
  });
});
