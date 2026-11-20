import type { PlaceCandidate } from '@/integrations/google-places/types';

export interface RankedPlace extends PlaceCandidate {
  score: number;
  rank: number;
}

export interface RankOptions {
  /** Số đánh giá "giả định" kéo điểm về trung bình chung C (độ tin cậy của prior). */
  m: number;
  /** Item có ít đánh giá hơn ngưỡng này bị loại. */
  minReviews: number;
}

/**
 * Bayesian average: score = v/(v+m)·R + m/(v+m)·C.
 * Item ít đánh giá được kéo về C để một quán 5 sao với 1 review không đứng đầu.
 * Không mutate `items`.
 */
export function rankPlaces(items: PlaceCandidate[], opts: RankOptions): RankedPlace[] {
  const eligible = items.filter(
    (p): p is PlaceCandidate & { rating: number } => p.rating !== null && p.reviewCount >= opts.minReviews,
  );
  if (eligible.length === 0) return [];

  const c = eligible.reduce((sum, p) => sum + p.rating, 0) / eligible.length;

  return eligible
    .map((p) => {
      const v = p.reviewCount;
      const score = (v / (v + opts.m)) * p.rating + (opts.m / (v + opts.m)) * c;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
