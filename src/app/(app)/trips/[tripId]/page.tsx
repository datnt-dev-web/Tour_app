import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { TripScreen } from '@/features/trips/ui/trip-screen';
import { createServerSupabase } from '@/shared/supabase/server';

export default async function TripPage({ params }: PageProps<'/trips/[tripId]'>) {
  const { tripId } = await params;
  // Id không phải uuid làm Postgres báo lỗi cú pháp; coi như không tìm thấy.
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) notFound();
  const detail = await createTripsRepo(await createServerSupabase()).getTripDetail(tripId);
  if (!detail) notFound();
  // useSearchParams (?view=) trong TripScreen cần Suspense để build tĩnh không vỡ.
  return (
    <Suspense>
      <TripScreen tripId={tripId} initialData={detail} />
    </Suspense>
  );
}
