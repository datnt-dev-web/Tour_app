import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { PRAISED_LIMIT } from '@/features/places/ui/book-queries';
import { listBook } from '@/features/places/services/book-service';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { HomeScreen } from '@/features/trips/ui/home-screen';
import { createServerSupabase } from '@/shared/supabase/server';

export default async function Home() {
  const ctx = await getRequestGroup();
  if (!ctx?.group) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-extrabold">Chuyến đi</h1>
        <p className="py-8 text-center text-sm text-muted">Bạn chưa ở nhóm nào. Hãy nhờ bạn bè gửi link mời.</p>
      </main>
    );
  }
  const supabase = await createServerSupabase();
  const [trips, praised] = await Promise.all([
    createTripsRepo(supabase).listTrips(ctx.group.id),
    listBook(createPlacesRepo(supabase), ctx.group.id, { verdict: 'up' }),
  ]);
  return <HomeScreen userId={ctx.userId} groupId={ctx.group.id} groupName={ctx.group.name} initialTrips={trips} initialPraised={praised.slice(0, PRAISED_LIMIT)} />;
}
