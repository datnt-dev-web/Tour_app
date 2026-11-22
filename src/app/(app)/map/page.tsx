import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { listTrips } from '@/features/trips/services/trips-service';
import { createServerSupabase } from '@/shared/supabase/server';
import { todayInVietnam } from '@/shared/date';
import { buttonClass } from '@/shared/ui/button';

// Tab "Bản đồ" mở thẳng bản đồ của chuyến sắp đi gần nhất (không có thì chuyến gần đây nhất).
export default async function MapTab() {
  const ctx = await getRequestGroup();
  if (ctx?.group) {
    const { upcoming, past } = await listTrips(createTripsRepo(await createServerSupabase()), ctx.group.id, todayInVietnam());
    const trip = upcoming[0] ?? past[0];
    if (trip) redirect(`/trips/${trip.id}?view=map`);
  }
  return (
    <main className="animate-enter px-2 py-4">
      <h1 className="text-xl font-extrabold">Bản đồ</h1>
      <p className="py-8 text-center text-sm text-muted">Chưa có chuyến nào để xem trên bản đồ.</p>
      <Link href="/" className={buttonClass('primary', 'mx-auto flex max-w-xs')}>
        Tạo chuyến mới
      </Link>
    </main>
  );
}
