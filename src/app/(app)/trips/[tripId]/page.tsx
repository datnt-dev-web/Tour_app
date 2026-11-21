import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { TripScreen } from '@/features/trips/ui/trip-screen';
import { parseTripView, stopsFilter } from '@/features/trips/ui/trip-view';
import { createServerSupabase } from '@/shared/supabase/server';

export default async function TripPage({ params, searchParams }: PageProps<'/trips/[tripId]'>) {
  const { tripId } = await params;
  // Id không phải uuid làm Postgres báo lỗi cú pháp; coi như không tìm thấy.
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) notFound();
  const view = parseTripView((await searchParams).view as string | undefined);
  const repo = createTripsRepo(await createServerSupabase());

  // Tải sẵn trang đầu của đúng tab đang mở (bộ lọc mặc định), để lần đầu vào không phải chờ client tải.
  const query = view === 'map' ? null : { ...stopsFilter(view, 'all'), page: 1 };
  const [info, stops, stats] = await Promise.all([
    repo.getTripInfo(tripId),
    query ? repo.listStops(tripId, query) : null,
    view === 'stats' ? repo.getTripStats(tripId) : null,
  ]);
  if (!info) notFound();

  // useSearchParams (?view=) trong TripScreen cần Suspense để build tĩnh không vỡ.
  return (
    <Suspense>
      <TripScreen
        tripId={tripId}
        initialInfo={info}
        initialStops={query && stops ? { query, data: stops } : undefined}
        initialStats={stats ?? undefined}
      />
    </Suspense>
  );
}
