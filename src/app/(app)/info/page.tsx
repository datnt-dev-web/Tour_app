import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { isFileUploadEnabled } from '@/features/info/server/info-deps';
import { InfoScreen } from '@/features/info/ui/info-screen';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { listTrips } from '@/features/trips/services/trips-service';
import { todayInVietnam } from '@/shared/date';
import { createServerSupabase } from '@/shared/supabase/server';

// Tab "Thông tin": mặc định chuyến sắp đi gần nhất (không có thì chuyến gần nhất đã đi), đổi bằng ?trip=.
export default async function InfoPage({ searchParams }: PageProps<'/info'>) {
  const ctx = await getRequestGroup();
  const { upcoming, past } = ctx?.group
    ? await listTrips(createTripsRepo(await createServerSupabase()), ctx.group.id, todayInVietnam())
    : { upcoming: [], past: [] };
  const trips = [...upcoming, ...past].map((t) => ({ id: t.id, name: t.name, city: t.city }));
  const wanted = (await searchParams).trip;
  const selected = trips.find((t) => t.id === wanted) ?? trips[0] ?? null;

  return <InfoScreen trips={trips} selectedId={selected?.id ?? null} uploadEnabled={isFileUploadEnabled()} />;
}
