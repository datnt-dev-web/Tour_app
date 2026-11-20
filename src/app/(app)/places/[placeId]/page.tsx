import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { loadPlaceView } from '@/features/places/server/load-place-view';
import type { PlaceView } from '@/features/places/services/place-service';
import { PlaceUnavailable } from '@/features/places/ui/place-unavailable';
import { PlaceScreen } from '@/features/places/ui/place-screen';
import { AppError } from '@/shared/errors';

export default async function PlacePage({ params }: PageProps<'/places/[placeId]'>) {
  const { placeId } = await params;
  const placeKey = decodeURIComponent(placeId);
  const ctx = await getRequestGroup();
  if (!ctx?.group) notFound();
  let view: PlaceView;
  try {
    view = await loadPlaceView(ctx.group.id, placeKey);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    // getPlaceView chỉ ném PLACES_UNAVAILABLE khi chỗ chưa lưu (chỗ đã lưu được hạ cấp thành details null).
    if (e instanceof AppError && e.code === 'PLACES_UNAVAILABLE') return <PlaceUnavailable />;
    throw e;
  }
  // useSearchParams (?trip=, ?category=) trong PlaceScreen cần Suspense để build tĩnh không vỡ.
  return (
    <Suspense>
      <PlaceScreen groupId={ctx.group.id} placeKey={placeKey} initialData={view} />
    </Suspense>
  );
}
