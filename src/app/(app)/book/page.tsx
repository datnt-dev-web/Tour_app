import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { listBook } from '@/features/places/services/book-service';
import { BookScreen } from '@/features/places/ui/book-screen';
import { createServerSupabase } from '@/shared/supabase/server';

export default async function BookPage() {
  const ctx = await getRequestGroup();
  if (!ctx?.group) {
    return (
      <main className="animate-enter px-2 py-4">
        <h1 className="text-xl font-extrabold">Sổ quán</h1>
        <p className="py-8 text-center text-sm text-muted">Bạn chưa ở nhóm nào. Hãy nhờ bạn bè gửi link mời.</p>
      </main>
    );
  }
  const rows = await listBook(createPlacesRepo(await createServerSupabase()), ctx.group.id, {});
  return <BookScreen groupId={ctx.group.id} initialRows={rows} />;
}
