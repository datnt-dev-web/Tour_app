import type { PlaceCategory } from '@/integrations/google-places/types';
import type { StoredPlaceCategory } from './repositories/places-repo';

/** Thứ tự hiển thị đồng thời là danh sách hợp lệ của loại chỗ lưu trong DB. */
export const STORED_CATEGORIES: StoredPlaceCategory[] = ['food', 'snack', 'cafe', 'play', 'stay', 'gift'];

export const CATEGORY_LABELS: Record<StoredPlaceCategory, string> = {
  food: 'Ăn chính',
  snack: 'Ăn vặt & chè',
  cafe: 'Cafe',
  play: 'Chỗ chơi',
  stay: 'Chỗ nghỉ',
  gift: 'Quà mang về',
};

/** Loại tìm được trên Khám phá (Google Places không có 'gift'). */
export const EXPLORE_CATEGORIES = STORED_CATEGORIES.filter((c): c is PlaceCategory => c !== 'gift');
