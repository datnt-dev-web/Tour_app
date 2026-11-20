'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/shared/query/keys';
import { Skeleton } from '@/shared/ui/skeleton';
import type { RankedPlace } from '../services/ranking';
import { buildExploreQuery, readParams, syncCityFromUrl, type ExploreParams } from './explore-params';
import { Filters } from './filters';
import { ResultCard } from './result-card';

const CITY_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;

async function fetchExplore(params: ExploreParams): Promise<RankedPlace[]> {
  const qs = new URLSearchParams({ city: params.city, category: params.category });
  if (params.price) qs.set('price', String(params.price));
  const res = await fetch(`/api/explore?${qs}`);
  if (!res.ok) throw new Error('explore failed');
  return ((await res.json()) as { results: RankedPlace[] }).results;
}

export function ExploreScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = readParams(searchParams);
  const [cityInput, setCityInput] = useState(params.city);

  // Luôn đọc params mới nhất lúc timer nổ, để chip bấm trong lúc chờ debounce không bị ghi đè.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  // Chip dùng push (back/forward giữ bộ lọc), gõ thành phố dùng replace để không làm đầy lịch sử.
  const updateUrl = (patch: Partial<ExploreParams>, mode: 'push' | 'replace' = 'push') =>
    router[mode](`${pathname}?${buildExploreQuery(paramsRef.current, patch)}`);

  // City đã đẩy lên URL bởi chính component này: URL tới trễ mang giá trị đó thì không được ghi đè ô nhập đang gõ tiếp.
  const [pushedCity, setPushedCity] = useState(params.city);
  const [syncedCity, setSyncedCity] = useState(params.city);
  if (syncedCity !== params.city) {
    setSyncedCity(params.city);
    const sync = syncCityFromUrl(params.city, pushedCity);
    if (sync.input !== null) setCityInput(sync.input); // URL đổi từ ngoài (back/forward)
    setPushedCity(sync.pushed);
  }

  useEffect(() => {
    const city = cityInput.trim();
    if (city === paramsRef.current.city) return;
    const t = setTimeout(() => {
      setPushedCity(city);
      updateUrl({ city }, 'replace');
    }, CITY_DEBOUNCE_MS);
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
