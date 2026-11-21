import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { listBook } from '@/features/places/services/book-service';
import { BookScreen } from '@/features/places/ui/book-screen';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { splitTrips } from '@/features/trips/services/trips-service';
import { todayInVietnam } from '@/shared/date';
import { createServerSupabase } from '@/shared/supabase/server';
import { normalizeText } from '@/shared/text';

export default async function BookPage() {
  const ctx = await getRequestGroup();
  if (!ctx?.group) {
    return (
      <main className="animate-enter px-2 py-4">
        <h1 className="text-xl font-extrabold">Sổ quán</h1>
        <p className="py-8 text-center text-sm text-muted">Bạn chưa ở nhóm nào. Liên hệ admin để được cấp quyền.</p>
      </main>
    );
  }
  const supabase = await createServerSupabase();
  const [rows, trips] = await Promise.all([
    listBook(createPlacesRepo(supabase), ctx.group.id, {}),
    createTripsRepo(supabase).listTrips(ctx.group.id),
  ]);
  const next = splitTrips(trips, todayInVietnam()).upcoming[0];
  return <BookScreen groupId={ctx.group.id} initialRows={rows} preferredCityKey={next ? normalizeText(next.city) : null} />;
}
