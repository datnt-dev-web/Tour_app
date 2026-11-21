import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createInfoDeps, isFileUploadEnabled } from '@/features/info/server/info-deps';
import { listInfos } from '@/features/info/services/info-service';
import { InfoScreen, type InfoSection } from '@/features/info/ui/info-screen';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { listTrips } from '@/features/trips/services/trips-service';
import { todayInVietnam } from '@/shared/date';
import { createServerSupabase } from '@/shared/supabase/server';

// Tab "Thông tin": mặc định chuyến sắp đi gần nhất (không có thì chuyến gần nhất đã đi), đổi bằng ?trip=.
export default async function InfoPage({ searchParams }: PageProps<'/info'>) {
  const ctx = await getRequestGroup();
  const db = await createServerSupabase();
  const { upcoming, past } = ctx?.group
    ? await listTrips(createTripsRepo(db), ctx.group.id, todayInVietnam())
    : { upcoming: [], past: [] };
  const trips = [...upcoming, ...past].map((t) => ({ id: t.id, name: t.name, city: t.city }));
  const sp = await searchParams;
  const wanted = sp.trip;
  const section: InfoSection = sp.section === 'photos' ? 'photos' : 'info';
  const selected = trips.find((t) => t.id === wanted) ?? trips[0] ?? null;
  // Lấy sẵn ở server để HTML đầu đã có danh sách: client khôi phục cache từ IndexedDB trước khi hydrate,
  // nếu server chỉ render skeleton thì hai bên lệch nhau (lỗi hydration).
  const initialItems = selected && section === 'info' ? await listInfos(createInfoDeps(db), selected.id) : [];

  return <InfoScreen trips={trips} selectedId={selected?.id ?? null} section={section} initialItems={initialItems} uploadEnabled={isFileUploadEnabled()} />;
}
