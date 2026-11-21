'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HotPlacesButton, UnverifiedHotPlaces } from '@/features/ai/ui/hot-places-button';
import type { HotPlace } from '@/features/ai/services/ai-service';
import { addedKey, useAddToTrip } from '@/features/trips/ui/use-trip-mutations';
import { queryKeys } from '@/shared/query/keys';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import type { RankedPlace } from '../services/ranking';
import { buildExploreQuery, readParams, syncCityFromUrl, type ExploreParams } from './explore-params';
import { Filters } from './filters';
import { ResultCard } from './result-card';

// Hộp chọn chuyến chỉ mở khi bấm "Thêm": tách chunk riêng cho trang Khám phá nhẹ hơn.
const AddToTripSheet = dynamic(() => import('@/features/trips/ui/add-to-trip-sheet').then((m) => m.AddToTripSheet), { ssr: false });

const CITY_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;

async function fetchExplore(params: Omit<ExploreParams, 'trip'>): Promise<RankedPlace[]> {
  const qs = new URLSearchParams({ city: params.city, category: params.category });
  if (params.price) qs.set('price', String(params.price));
  const res = await fetch(`/api/explore?${qs}`);
  if (!res.ok) throw new Error('explore failed');
  return ((await res.json()) as { results: RankedPlace[] }).results;
}

export function ExploreScreen({ groupId }: { groupId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = readParams(searchParams);
  const [cityInput, setCityInput] = useState(params.city);
  const { trip: tripId, ...search } = params;

  // Tập (chuyến, chỗ) đã thêm trong phiên này; thêm lạc quan khi bấm, bỏ ra nếu server báo lỗi.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<RankedPlace | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const addMutation = useAddToTrip({
    onMutate: (id) => {
      setAddError(null);
      setAdded((s) => new Set(s).add(id));
    },
    onError: (id, message) => {
      setAdded((s) => new Set([...s].filter((x) => x !== id)));
      setAddError(message);
    },
  });
  const addTo = (place: RankedPlace, toTripId: string) =>
    addMutation.mutate({
      googlePlaceId: place.googlePlaceId,
      input: { tripId: toTripId, candidate: place, category: params.category, city: params.city },
    });
  // Có ?trip= thì thêm thẳng, không thì chọn chuyến trong sheet.
  const onAdd = groupId ? (place: RankedPlace) => (tripId ? addTo(place, tripId) : setPending(place)) : undefined;

  const detailQuery = new URLSearchParams({ category: params.category, ...(tripId ? { trip: tripId } : {}) }).toString();

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
    queryKey: queryKeys.explore(search),
    queryFn: () => fetchExplore(search),
    enabled: params.city !== '',
    placeholderData: keepPreviousData,
  });

  // Gợi ý AI chỉ hiện cho đúng (thành phố, loại) đã hỏi; đổi bộ lọc thì ẩn đi.
  const [hot, setHot] = useState<{ city: string; category: string; places: HotPlace[] } | null>(null);
  const hotHere = hot && hot.city === params.city && hot.category === params.category ? hot.places : [];
  const known = new Set(data?.map((p) => p.googlePlaceId));
  const aiPlaces: RankedPlace[] = [];
  for (const h of hotHere) {
    const c = h.candidate;
    if (c && !known.has(c.googlePlaceId)) {
      known.add(c.googlePlaceId);
      aiPlaces.push({ ...c, score: 0, rank: (data?.length ?? 0) + aiPlaces.length + 1 });
    }
  }
  const unverified = hotHere.filter((h) => !h.verified);

  const renderCard = (place: RankedPlace, badge?: ReactNode) => (
    <ResultCard key={place.googlePlaceId} place={place} badge={badge} onAdd={onAdd} detailQuery={detailQuery} added={tripId ? added.has(addedKey(tripId, place.googlePlaceId)) : false} />
  );

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
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
          data.map((place) => renderCard(place))
        )}
        {aiPlaces.map((place) =>
          renderCard(
            place,
            <Badge tone="ai">
              <Sparkles size={12} aria-hidden />
              AI gợi ý
            </Badge>,
          ),
        )}
      </section>
      {groupId && params.city !== '' && (
        <HotPlacesButton city={params.city} category={params.category} onResult={(places) => setHot({ city: params.city, category: params.category, places })} />
      )}
      <UnverifiedHotPlaces places={unverified} city={params.city} />
      {addError && (
        <p role="alert" className="text-sm text-bad">
          {addError}
        </p>
      )}
      {pending && groupId && (
        <AddToTripSheet
          groupId={groupId}
          placeName={pending.name}
          isAdded={(id) => added.has(addedKey(id, pending.googlePlaceId))}
          onClose={() => setPending(null)}
          onPick={(id) => {
            addTo(pending, id);
            setPending(null);
          }}
        />
      )}
    </main>
  );
}
