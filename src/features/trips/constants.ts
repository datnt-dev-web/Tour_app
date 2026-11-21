import type { BadgeTone } from '@/shared/ui/badge';
import type { TripPlaceStatus } from './repositories/trips-repo';

export const STATUS_LABELS: Record<TripPlaceStatus, string> = {
  wanted: 'Chưa chốt',
  confirmed: 'Đã chốt',
  visited: 'Đã đi',
  dropped: 'Bỏ',
};

export const STATUS_TONES: Record<TripPlaceStatus, BadgeTone> = {
  wanted: 'warn',
  confirmed: 'good',
  visited: 'neutral',
  dropped: 'bad',
};

export const TRIP_PLACE_STATUSES = Object.keys(STATUS_LABELS) as TripPlaceStatus[];

/** Gợi ý nhanh cho cột "Di chuyển"; vẫn gõ tự do được (lưu dạng chữ). */
export const TRANSPORT_PRESETS = ['Đi bộ', 'Xe máy', 'Xe máy thuê', 'Taxi/Grab', 'Ô tô', 'Xe buýt', 'Tàu', 'Máy bay'];

/** Nút chọn nhanh thời lượng ở một chỗ (phút), để đặt giờ kết thúc theo giờ bắt đầu. */
export const DURATION_PRESETS_MIN = [30, 45, 60, 90, 120];

export type TripTab = 'all' | 'confirmed' | 'wanted';

export const TRIP_TABS: { value: TripTab; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'confirmed', label: 'Đã chốt' },
  { value: 'wanted', label: 'Chưa chốt' },
];

/** Trạng thái hiển thị theo tab; 'dropped' không bao giờ hiện. */
export const TAB_STATUSES: Record<TripTab, TripPlaceStatus[]> = {
  all: ['wanted', 'confirmed', 'visited'],
  confirmed: ['confirmed', 'visited'],
  wanted: ['wanted'],
};
