'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PlaceCategory, PriceTier } from '@/integrations/google-places/types';
import { queryKeys } from '@/shared/query/keys';
import { Skeleton } from '@/shared/ui/skeleton';
import type { RankedPlace } from '../services/ranking';
import { CATEGORIES, Filters } from './filters';
import { ResultCard } from './result-card';

const CITY_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;
const DEFAULT_CATEGORY: PlaceCategory = 'food';

interface ExploreParams {
  city: string;
  category: PlaceCategory;
  price?: PriceTier;
}

async function fetchExplore(params: ExploreParams): Promise<RankedPlace[]> {
  const qs = new URLSearchParams({ city: params.city, category: params.category });
  if (params.price) qs.set('price', String(params.price));
  const res = await fetch(`/api/explore?${qs}`);
  if (!res.ok) throw new Error('explore failed');
  return ((await res.json()) as { results: RankedPlace[] }).results;
}

function readParams(sp: URLSearchParams): ExploreParams {
  const category = CATEGORIES.find((c) => c.value === sp.get('category'))?.value ?? DEFAULT_CATEGORY;
  const price = Number(sp.get('price'));
  return {
    city: sp.get('city')?.trim() ?? '',
    category,
    price: price === 1 || price === 2 || price === 3 ? price : undefined,
  };
}

export function ExploreScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = readParams(searchParams);
  const [cityInput, setCityInput] = useState(params.city);

  // Ghi URL: chip dùng push (back/forward giữ bộ lọc), gõ thành phố dùng replace để không làm đầy lịch sử.
  const updateUrl = (patch: Partial<ExploreParams>, mode: 'push' | 'replace' = 'push') => {
    const next = { ...params, ...patch };
    const qs = new URLSearchParams();
    if (next.city) qs.set('city', next.city);
    qs.set('category', next.category);
    if (next.price) qs.set('price', String(next.price));
    router[mode](`${pathname}?${qs}`);
  };

  // Đồng bộ ô nhập khi URL đổi từ ngoài (back/forward); chỉnh state ngay lúc render thay vì trong effect.
  const [syncedCity, setSyncedCity] = useState(params.city);
  if (syncedCity !== params.city) {
    setSyncedCity(params.city);
    setCityInput(params.city);
  }

  useEffect(() => {
    const city = cityInput.trim();
    if (city === params.city) return;
    const t = setTimeout(() => updateUrl({ city }, 'replace'), CITY_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy lại khi người dùng gõ
  }, [cityInput]);

  const { data, isError, isPending } = useQuery({
    queryKey: queryKeys.explore(params),
    queryFn: () => fetchExplore(params),
    enabled: params.city !== '',
    placeholderData: keepPreviousData,
  });

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-extrabold">Khám phá</h1>
      <Filters
        city={cityInput}
        category={params.category}
        priceTier={params.price}
        onCityChange={setCityInput}
        onCategoryChange={(category) => updateUrl({ category })}
        onPriceChange={(price) => updateUrl({ price })}
      />
      <section aria-live="polite" className="flex flex-col gap-3">
        {params.city === '' ? (
          <p className="py-8 text-center text-sm text-muted">Nhập thành phố để bắt đầu.</p>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-bad">Không tải được dữ liệu Google Maps, thử lại sau.</p>
        ) : isPending ? (
          Array.from({ length: SKELETON_COUNT }, (_, i) => <Skeleton key={i} className="h-32" />)
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Chưa tìm thấy chỗ phù hợp. Thử bỏ bớt bộ lọc giá.</p>
        ) : (
          data.map((place) => <ResultCard key={place.googlePlaceId} place={place} />)
        )}
      </section>
    </main>
  );
}
