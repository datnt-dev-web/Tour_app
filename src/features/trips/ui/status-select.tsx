'use client';

import type { BadgeTone } from '@/shared/ui/badge';
import { Dropdown } from '@/shared/ui/dropdown';
import { STATUS_LABELS, STATUS_TONES, TRIP_PLACE_STATUSES } from '../constants';
import type { TripPlaceStatus } from '../repositories/trips-repo';

const DOT: Record<BadgeTone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-muted',
  ai: 'bg-ai',
  accent: 'bg-accent',
};

const OPTIONS = TRIP_PLACE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], dot: DOT[STATUS_TONES[s]] }));

/** Chọn trạng thái của một chỗ: chấm màu theo trạng thái (cùng màu nhãn trạng thái). */
export function StatusSelect({ value, onChange, label }: { value: TripPlaceStatus; onChange: (s: TripPlaceStatus) => void; label: string }) {
  return <Dropdown label={label} value={value} options={OPTIONS} onChange={onChange} className="min-w-0 flex-1" />;
}
