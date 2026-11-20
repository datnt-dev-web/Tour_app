import { describe, expect, test } from 'vitest';
import type { PlaceCandidate } from '@/integrations/google-places/types';
import { rankPlaces } from '@/features/explore/services/ranking';

const P = (id: string, rating: number | null, reviewCount: number): PlaceCandidate => ({
  googlePlaceId: id,
  rating,
  reviewCount,
  name: id,
  address: '',
  priceTier: 1,
  openNow: null,
  mapsUrl: '',
});

describe('rankPlaces', () => {
  test('nhiều đánh giá thắng điểm cao ít đánh giá', () => {
    const r = rankPlaces([P('a', 4.9, 12), P('b', 4.6, 3000), P('c', 4.2, 800), P('d', 4.0, 500)], { m: 50, minReviews: 0 });
    expect(r.map((x) => x.googlePlaceId)).toEqual(['b', 'a', 'c', 'd']);
    expect(r[0].score).toBeCloseTo(4.597, 2);
    expect(r[0].rank).toBe(1);
  });

  test('loại item dưới minReviews và rating null', () => {
    expect(rankPlaces([P('a', 4.9, 12), P('b', null, 0), P('c', 4.2, 800)], { m: 50, minReviews: 20 }).map((x) => x.googlePlaceId)).toEqual(['c']);
  });

  test('mảng rỗng → []', () => {
    expect(rankPlaces([], { m: 50, minReviews: 20 })).toEqual([]);
  });
});
