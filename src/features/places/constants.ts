import type { PlaceCategory } from '@/integrations/google-places/types';
import type { BadgeTone } from '@/shared/ui/badge';
import type { StoredPlaceCategory } from './repositories/places-repo';
import type { BookVerdict } from './services/book-service';

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

export const VERDICT_LABELS: Record<BookVerdict, string> = { up: 'Khen', down: 'Không ăn lại', none: 'Chưa thử' };
export const VERDICT_TONES: Record<BookVerdict, BadgeTone> = { up: 'good', down: 'bad', none: 'neutral' };

export const BOOK_FILTERS: { value: BookVerdict | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'up', label: VERDICT_LABELS.up },
  { value: 'down', label: VERDICT_LABELS.down },
  { value: 'none', label: VERDICT_LABELS.none },
];

/** Khóa dùng trong URL `/places/[placeId]`: Google id, hoặc `local:<uuid>` cho chỗ thêm tay. */
export const placeKeyOf = (p: { placeId: string; googlePlaceId: string | null }) => p.googlePlaceId ?? `local:${p.placeId}`;
