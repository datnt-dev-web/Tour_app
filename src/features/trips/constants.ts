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
