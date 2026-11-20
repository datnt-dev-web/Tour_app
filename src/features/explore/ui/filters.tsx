'use client';

import { MapPin } from 'lucide-react';
import type { PlaceCategory, PriceTier } from '@/integrations/google-places/types';
import { Chip } from '@/shared/ui/chip';

export const CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: 'food', label: 'Ăn chính' },
  { value: 'snack', label: 'Ăn vặt & chè' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'play', label: 'Chỗ chơi' },
  { value: 'stay', label: 'Chỗ nghỉ' },
];

export const PRICE_TIERS: { value: PriceTier; label: string }[] = [
  { value: 1, label: '₫' },
  { value: 2, label: '₫₫' },
  { value: 3, label: '₫₫₫' },
];

interface FiltersProps {
  city: string;
  category: PlaceCategory;
  priceTier?: PriceTier;
  onCityChange: (city: string) => void;
  onCategoryChange: (category: PlaceCategory) => void;
  /** undefined = bỏ lọc giá (tất cả mức giá). */
  onPriceChange: (tier: PriceTier | undefined) => void;
}

export function Filters({ city, category, priceTier, onCityChange, onCategoryChange, onPriceChange }: FiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center gap-2 rounded border border-line bg-white px-3">
        <MapPin size={18} className="shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Thành phố, ví dụ Hải Phòng"
          aria-label="Thành phố"
          className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Loại chỗ">
        {CATEGORIES.map((c) => (
          <Chip key={c.value} selected={category === c.value} onClick={() => onCategoryChange(c.value)} className="shrink-0">
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2" role="group" aria-label="Mức giá">
        {PRICE_TIERS.map((t) => (
          <Chip key={t.value} selected={priceTier === t.value} onClick={() => onPriceChange(priceTier === t.value ? undefined : t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
