import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { HomeScreen } from '@/features/trips/ui/home-screen';
import { createServerSupabase } from '@/shared/supabase/server';

export default async function Home() {
  const ctx = await getRequestGroup();
  if (!ctx?.group) {
    return (
      <main className="animate-enter px-2 py-4">
        <h1 className="text-xl font-extrabold">Chuyến đi</h1>
        <p className="py-8 text-center text-sm text-muted">Bạn chưa ở nhóm nào. Liên hệ admin để được cấp quyền.</p>
      </main>
    );
  }
  const trips = await createTripsRepo(await createServerSupabase()).listTrips(ctx.group.id);
  return <HomeScreen userId={ctx.userId} groupId={ctx.group.id} groupName={ctx.group.name} initialTrips={trips} />;
}
