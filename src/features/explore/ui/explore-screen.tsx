'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Check, LocateFixed, MapPin, Navigation, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SuggestInput } from '@/features/geo/ui/suggest-input';
import { CATEGORY_LABELS, placeKeyOf, STORED_CATEGORIES } from '@/features/places/constants';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { bookQuery } from '@/features/places/ui/book-queries';
import { VerdictBadge } from '@/features/places/ui/verdict-badge';
import { addManualPlaceAction } from '@/features/trips/actions/trip-actions';
import { formatDistance } from '@/features/trips/ui/geo';
import { directionsUrl } from '@/features/trips/ui/trip-view';
import { useMyLocation } from '@/features/trips/ui/use-my-location';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { Card } from '@/shared/ui/card';
import { Chip } from '@/shared/ui/chip';
import { Skeleton } from '@/shared/ui/skeleton';
import { useDebouncedValue } from '@/shared/ui/use-debounced-value';
import type { ExploreNearbyPlace, ExploreNearbyResult } from '../services/nearby-service';
import { pickBookForExplore } from '../services/nearby-service';

// Hộp chọn chuyến chỉ mở khi bấm "Thêm": tách chunk riêng cho trang Khám phá nhẹ hơn.
const AddToTripSheet = dynamic(() => import('@/features/trips/ui/add-to-trip-sheet').then((m) => m.AddToTripSheet), { ssr: false });

const CITY_DEBOUNCE_MS = 400;
// Một ký tự ("H") chưa phải tên thành phố: không tốn một lượt geocode + Overpass cho nó.
const MIN_CITY_CHARS = 2;
const SKELETON_COUNT = 4;
const BOOK_LIMIT = 6;

type Mode = { kind: 'city' } | { kind: 'near'; lat: number; lng: number };

async function fetchNearby(category: StoredPlaceCategory, mode: Mode, city: string, signal: AbortSignal): Promise<ExploreNearbyResult> {
  const qs = new URLSearchParams({ category });
  if (mode.kind === 'near') {
    qs.set('lat', String(mode.lat));
    qs.set('lng', String(mode.lng));
  } else qs.set('city', city);
  const res = await fetch(`/api/explore?${qs}`, { signal });
  const body = (await res.json().catch(() => null)) as (ExploreNearbyResult & { error?: { message?: string } }) | null;
  if (res.ok && body) return body;
  throw new Error(body?.error?.message ?? 'Không tải được dữ liệu bản đồ, thử lại sau.');
}

/** Khám phá: Sổ quán của nhóm + chỗ trên OpenStreetMap quanh tôi hoặc quanh trung tâm thành phố. */
export function ExploreScreen({ groupId }: { groupId: string | null }) {
  const sp = useSearchParams();
  const tripId = sp.get('trip');
  const [cityInput, setCityInput] = useState(sp.get('city') ?? '');
  const city = useDebouncedValue(cityInput.trim(), CITY_DEBOUNCE_MS);
  const [category, setCategory] = useState<StoredPlaceCategory>('food');
  const { location, start, stop } = useMyLocation();
  const nearMe = location.status === 'ok';
  const mode: Mode = nearMe ? { kind: 'near', lat: location.coords.lat, lng: location.coords.lng } : { kind: 'city' };
  // Làm tròn vị trí (~100 m) để đi lại vài bước không bắn truy vấn mới.
  const modeKey = mode.kind === 'near' ? `${mode.lat.toFixed(3)},${mode.lng.toFixed(3)}` : city;

  const searching = nearMe || city.length >= MIN_CITY_CHARS;

  const nearby = useQuery({
    queryKey: queryKeys.explore({ category, modeKey }),
    queryFn: ({ signal }) => fetchNearby(category, mode, city, signal),
    enabled: searching,
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const { data: book = [] } = useQuery({ ...bookQuery(groupId ?? ''), enabled: !!groupId });
  const bookHere = city ? pickBookForExplore(book, city, category).slice(0, BOOK_LIMIT) : [];

  // Thêm vào chuyến: có ?trip= thì thêm thẳng, không thì chọn chuyến.
  const [pending, setPending] = useState<ExploreNearbyPlace | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const add = useMutation({
    mutationFn: async (v: { tripId: string; place: ExploreNearbyPlace }) =>
      unwrap(
        await addManualPlaceAction({
          tripId: v.tripId,
          name: v.place.name,
          address: v.place.address ?? '',
          category,
          note: '',
          schedule: null,
          transport: null,
          cost: null,
        }),
      ),
    onSuccess: (_d, v) => setAdded((s) => new Set(s).add(`${v.tripId}:${v.place.osmId}`)),
  });
  const onAdd = groupId ? (p: ExploreNearbyPlace) => (tripId ? add.mutate({ tripId, place: p }) : setPending(p)) : undefined;

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <h1 className="text-xl font-extrabold">Khám phá</h1>

      <div className="flex gap-2">
        <label className="relative flex min-h-11 flex-1 items-center gap-2 rounded border border-line bg-card px-3 focus-within:border-accent">
          <MapPin size={18} className="shrink-0 text-muted" aria-hidden />
          <SuggestInput
            kind="city"
            type="search"
            value={cityInput}
            onChange={(v) => {
              setCityInput(v);
              if (nearMe) stop();
            }}
            onPick={(s) => setCityInput(s.name)}
            wrapperClassName="w-full"
            placeholder="Thành phố, ví dụ Hải Phòng"
            aria-label="Thành phố"
            className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="button"
          aria-pressed={nearMe}
          onClick={nearMe ? stop : start}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded border px-3 text-sm font-semibold pressable ${nearMe ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-surface'}`}
        >
          <LocateFixed size={18} aria-hidden />
          Gần tôi
        </button>
      </div>
      {(location.status === 'denied' || location.status === 'unavailable') && (
        <p className="text-sm text-bad">Không lấy được vị trí. Hãy cho phép quyền vị trí cho trang này rồi thử lại.</p>
      )}
      {location.status === 'locating' && <p className="text-sm text-muted">Đang lấy vị trí…</p>}

      <div role="group" aria-label="Loại chỗ" className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
        {STORED_CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="shrink-0">
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      {bookHere.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Nhóm từng lưu</h2>
          {bookHere.map((r) => (
            <Link key={r.placeId} href={`/places/${encodeURIComponent(placeKeyOf(r))}`} className="pressable block">
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-sm text-muted">{r.note || r.address || r.city}</p>
                </div>
                <VerdictBadge verdict={r.verdict} className="shrink-0" />
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section aria-live="polite" className="flex flex-col gap-2">
        {searching && (
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{nearMe ? 'Quanh đây' : `Ở ${city}`}</h2>
        )}
        {!searching ? (
          <p className="py-8 text-center text-sm text-muted">Nhập thành phố hoặc bấm “Gần tôi” để tìm quán quanh bạn.</p>
        ) : nearby.isError ? (
          <p className="py-8 text-center text-sm text-bad">{nearby.error.message}</p>
        ) : nearby.isPending ? (
          Array.from({ length: SKELETON_COUNT }, (_, i) => <Skeleton key={i} className="h-20" />)
        ) : nearby.data.places.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Chưa thấy chỗ nào trên bản đồ. Thử loại khác hoặc mở rộng khu vực.</p>
        ) : (
          nearby.data.places.map((p) => (
            <NearbyCard key={p.osmId} place={p} onAdd={onAdd} added={tripId ? added.has(`${tripId}:${p.osmId}`) : false} pending={add.isPending && add.variables?.place.osmId === p.osmId} />
          ))
        )}
        <p className="text-xs text-muted">Dữ liệu © OpenStreetMap contributors.</p>
      </section>

      {add.error && (
        <p role="alert" className="text-sm text-bad">
          {add.error.message}
        </p>
      )}
      {pending && groupId && (
        <AddToTripSheet
          groupId={groupId}
          placeName={pending.name}
          isAdded={(id) => added.has(`${id}:${pending.osmId}`)}
          onClose={() => setPending(null)}
          onPick={(id) => {
            add.mutate({ tripId: id, place: pending });
            setPending(null);
          }}
        />
      )}
    </main>
  );
}

function NearbyCard({ place, onAdd, added, pending }: { place: ExploreNearbyPlace; onAdd?: (p: ExploreNearbyPlace) => void; added: boolean; pending: boolean }) {
  return (
    <Card className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{place.name}</p>
        <p className="truncate text-sm text-muted">
          {formatDistance(place.distanceM)}
          {place.address && ` · ${place.address}`}
        </p>
      </div>
      <a
        href={directionsUrl({ lat: place.lat, lng: place.lng, googlePlaceId: null })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chỉ đường tới ${place.name}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded text-accent pressable hover:bg-surface"
      >
        <Navigation size={18} aria-hidden />
      </a>
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(place)}
          disabled={added || pending}
          aria-label={added ? `Đã thêm ${place.name}` : `Thêm ${place.name} vào chuyến`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded bg-accent text-white pressable hover:bg-accent-strong disabled:opacity-50"
        >
          {added ? <Check size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
        </button>
      )}
    </Card>
  );
}
