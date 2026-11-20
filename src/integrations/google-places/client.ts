import 'server-only';
import { AppError } from '@/shared/errors';
import { CATEGORY_QUERY, mapPriceLevel, priceTierToLevels } from './mapping';
import type { PlaceCandidate, PlaceDetails, PlacesClient } from './types';

const BASE_URL = 'https://places.googleapis.com/v1';
const SEARCH_MASK =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.googleMapsUri';
const DETAILS_MASK =
  'id,displayName,formattedAddress,rating,userRatingCount,priceLevel,currentOpeningHours.openNow,googleMapsUri,regularOpeningHours.weekdayDescriptions,nationalPhoneNumber';
const PAGE_SIZE = 20;

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
}

function toCandidate(p: RawPlace): PlaceCandidate {
  return {
    googlePlaceId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
    priceTier: mapPriceLevel(p.priceLevel),
    openNow: p.currentOpeningHours?.openNow ?? null,
    mapsUrl: p.googleMapsUri ?? '',
  };
}

export function createGooglePlacesClient(apiKey: string): PlacesClient {
  // Không đưa lỗi gốc vào message: nó có thể chứa URL/key.
  async function call<T>(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { ...init.headers, 'X-Goog-Api-Key': apiKey } });
    } catch {
      throw new AppError('PLACES_UNAVAILABLE', 'Không kết nối được Google Places, thử lại sau.');
    }
    if (!res.ok) {
      throw new AppError('PLACES_UNAVAILABLE', `Google Places tạm thời không khả dụng (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async function search(body: Record<string, unknown>): Promise<PlaceCandidate[]> {
    const data = await call<{ places?: RawPlace[] }>(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': SEARCH_MASK },
      body: JSON.stringify({ languageCode: 'vi', regionCode: 'VN', ...body }),
    });
    return (data.places ?? []).map(toCandidate);
  }

  return {
    searchText({ city, category, priceTiers }) {
      const { textQuery, includedType } = CATEGORY_QUERY[category];
      return search({
        textQuery: textQuery(city),
        includedType,
        priceLevels: priceTiers?.length ? priceTiers.flatMap(priceTierToLevels) : undefined,
        pageSize: PAGE_SIZE,
      });
    },
    async searchOne(query) {
      return (await search({ textQuery: query, pageSize: 1 }))[0] ?? null;
    },
    async getDetails(id): Promise<PlaceDetails> {
      const p = await call<RawPlace>(`${BASE_URL}/places/${encodeURIComponent(id)}?languageCode=vi`, {
        method: 'GET',
        headers: { 'X-Goog-FieldMask': DETAILS_MASK },
      });
      return {
        ...toCandidate(p),
        weekdayHours: p.regularOpeningHours?.weekdayDescriptions ?? [],
        phone: p.nationalPhoneNumber ?? null,
      };
    },
  };
}
