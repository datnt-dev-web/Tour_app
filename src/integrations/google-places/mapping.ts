import type { PlaceCategory, PriceTier } from './types';

const LEVEL_TO_TIER: Record<string, PriceTier> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

export function mapPriceLevel(level?: string): PriceTier | null {
  return (level && LEVEL_TO_TIER[level]) || null;
}

// Bộ lọc priceLevels của Text Search không nhận PRICE_LEVEL_FREE nên tier 1 chỉ gửi INEXPENSIVE.
const TIER_TO_FILTER_LEVELS: Record<PriceTier, string[]> = {
  1: ['PRICE_LEVEL_INEXPENSIVE'],
  2: ['PRICE_LEVEL_MODERATE'],
  3: ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'],
};

export function priceTierToLevels(t: PriceTier): string[] {
  return TIER_TO_FILTER_LEVELS[t];
}

export const CATEGORY_QUERY: Record<PlaceCategory, { textQuery: (city: string) => string; includedType?: string }> = {
  food: { textQuery: (city) => `quán ăn ngon ở ${city}`, includedType: 'restaurant' },
  snack: { textQuery: (city) => `ăn vặt chè ở ${city}` },
  cafe: { textQuery: (city) => `cà phê ở ${city}`, includedType: 'cafe' },
  play: { textQuery: (city) => `địa điểm tham quan ở ${city}`, includedType: 'tourist_attraction' },
  stay: { textQuery: (city) => `homestay khách sạn giá tốt ở ${city}`, includedType: 'lodging' },
};
