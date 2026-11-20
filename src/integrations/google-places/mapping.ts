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

export function priceTierToLevels(t: PriceTier): string[] {
  return Object.keys(LEVEL_TO_TIER).filter((l) => LEVEL_TO_TIER[l] === t);
}

export const CATEGORY_QUERY: Record<PlaceCategory, { textQuery: (city: string) => string; includedType?: string }> = {
  food: { textQuery: (city) => `quán ăn ngon ở ${city}`, includedType: 'restaurant' },
  snack: { textQuery: (city) => `ăn vặt chè ở ${city}` },
  cafe: { textQuery: (city) => `cà phê ở ${city}`, includedType: 'cafe' },
  play: { textQuery: (city) => `địa điểm tham quan ở ${city}`, includedType: 'tourist_attraction' },
  stay: { textQuery: (city) => `homestay khách sạn giá tốt ở ${city}`, includedType: 'lodging' },
};
