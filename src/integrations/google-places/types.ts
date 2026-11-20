export type PlaceCategory = 'food' | 'snack' | 'cafe' | 'play' | 'stay';
export type PriceTier = 1 | 2 | 3;

export interface PlaceCandidate {
  googlePlaceId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  priceTier: PriceTier | null;
  openNow: boolean | null;
  mapsUrl: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceDetails extends PlaceCandidate {
  weekdayHours: string[];
  phone: string | null;
  /** null khi Google không trả tọa độ (hoặc bản cache cũ trước khi có trường này). Chỉ giữ ở cache, không ghi Postgres. */
  location: LatLng | null;
}

export interface PlacesClient {
  searchText(p: { city: string; category: PlaceCategory; priceTiers?: PriceTier[] }): Promise<PlaceCandidate[]>;
  searchOne(query: string): Promise<PlaceCandidate | null>;
  getDetails(id: string): Promise<PlaceDetails>;
}
