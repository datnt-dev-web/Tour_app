'use client';

import { ArrowLeft, Star } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AddToTripSheet } from '@/features/trips/ui/add-to-trip-sheet';
import { tripsQuery } from '@/features/trips/ui/trip-queries';
import { addedKey, useAddToTrip } from '@/features/trips/ui/use-trip-mutations';
import { weekdayIndexInVietnam } from '@/shared/date';
import { queryKeys } from '@/shared/query/keys';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useQuery } from '@/shared/query/use-query';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '../constants';
import type { PlaceView } from '../services/place-service';
import { CheckLinks } from './check-links';
import { InternalReviews } from './internal-reviews';
import { PlacePhotos } from './place-photos';

async function fetchPlaceView(placeKey: string): Promise<PlaceView> {
  const res = await fetch(`/api/places/${encodeURIComponent(placeKey)}`);
  if (!res.ok) throw new Error('place failed');
  return (await res.json()) as PlaceView;
}

/** Google trả "Thứ Hai: 08:00 – 22:00"; chỉ giữ phần giờ của hôm nay. */
function todayHours(weekdayHours: string[]): string {
  const line = weekdayHours[weekdayIndexInVietnam()];
  return line ? line.slice(line.indexOf(':') + 1).trim() : '—';
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-sm bg-surface p-3">
      <dd className="text-sm font-bold leading-snug">{children}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

/**
 * Màn chi tiết chỗ. `aiSlot` là chỗ gắn thẻ "Mạng xã hội nói gì?" (Task 10), hiện giữa "Tự kiểm tra" và "Nhóm nói gì".
 */
export function PlaceScreen({ groupId, placeKey, initialData, aiSlot }: { groupId: string; placeKey: string; initialData: PlaceView; aiSlot?: ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tripParam = sp.get('trip') || undefined;
  const { data: view } = useQuery({ queryKey: queryKeys.place(placeKey), queryFn: () => fetchPlaceView(placeKey), initialData });
  const { data: trips } = useQuery(tripsQuery(groupId));

  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [choosing, setChoosing] = useState(false);
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

  const { place, details, googlePlaceId } = view;
  const name = details?.name ?? place?.name ?? '';
  const address = details?.address ?? place?.address ?? '';
  const categoryParam = STORED_CATEGORIES.find((c) => c === sp.get('category'));
  const category = place?.category ?? categoryParam ?? 'food';
  const keyForAdd = googlePlaceId ?? placeKey;

  const cityOf = (tripId: string) => place?.city ?? trips?.find((t) => t.id === tripId)?.city;
  const addTo = (tripId: string) => {
    // Chỗ đã lưu thì thêm theo id; chỗ mới từ Khám phá thì lưu từ dữ liệu Google, thành phố lấy theo chuyến.
    const city = cityOf(tripId);
    if (!city) return;
    addMutation.mutate({
      googlePlaceId: keyForAdd,
      input: place ? { tripId, placeId: place.id, category, city } : { tripId, candidate: details!, category, city },
    });
  };
  const tripName = tripParam ? trips?.find((t) => t.id === tripParam)?.name : undefined;
  const isAddedToParam = tripParam ? added.has(addedKey(tripParam, keyForAdd)) : false;
  const cityForCheck = (tripParam ? cityOf(tripParam) : place?.city) ?? '';

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4 pb-40">
      <header className="flex flex-col gap-1">
        <button type="button" aria-label="Quay lại" onClick={() => router.back()} className="-ml-2 inline-flex size-11 items-center justify-center pressable rounded text-ink hover:bg-surface">
          <ArrowLeft size={20} aria-hidden />
        </button>
        <div className="flex flex-wrap gap-2">
          <Badge>{CATEGORY_LABELS[category]}</Badge>
          {!view.verified && <Badge tone="warn">Chưa xác minh</Badge>}
        </div>
        <h1 className="text-xl font-extrabold leading-tight">{name}</h1>
        {address && <p className="text-sm text-muted">{address}</p>}
      </header>

      {details ? (
        <dl className="grid grid-cols-3 gap-2">
          <Stat label={`${(details.reviewCount ?? 0).toLocaleString('vi-VN')} đánh giá`}>
            <span className="inline-flex items-center gap-1">
              <Star size={14} className="fill-warn text-warn" aria-hidden />
              {details.rating?.toFixed(1) ?? '—'}
            </span>
          </Stat>
          <Stat label="Mức giá">{details.priceTier ? '₫'.repeat(details.priceTier) : '—'}</Stat>
          <Stat label="Giờ hôm nay">{todayHours(details.weekdayHours)}</Stat>
        </dl>
      ) : (
        view.verified && <p className="text-sm text-muted">Không tải được dữ liệu Google Maps lúc này.</p>
      )}

      <CheckLinks name={name} city={cityForCheck} />

      {aiSlot}

      {place && <PlacePhotos placeId={place.id} tripId={tripParam} />}

      <InternalReviews reviews={view.reviews} groupId={groupId} placeKey={placeKey} placeId={place?.id ?? null} tripId={tripParam} />

      {addError && (
        <p role="alert" className="text-sm text-bad">
          {addError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[480px] border-t border-line bg-card px-2 py-3">
        <Button className="w-full" disabled={isAddedToParam || (tripParam !== undefined && !cityOf(tripParam))} onClick={() => (tripParam ? addTo(tripParam) : setChoosing(true))}>
          {isAddedToParam ? '✓ Đã thêm' : `Thêm vào chuyến${tripName ? ` ${tripName}` : ''}`}
        </Button>
      </div>

      {choosing && (
        <AddToTripSheet
          groupId={groupId}
          placeName={name}
          isAdded={(id) => added.has(addedKey(id, keyForAdd))}
          onClose={() => setChoosing(false)}
          onPick={(id) => {
            addTo(id);
            setChoosing(false);
          }}
        />
      )}
    </main>
  );
}
