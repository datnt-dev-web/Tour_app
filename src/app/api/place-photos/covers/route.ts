import { appErrorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createPhotoDeps } from '@/features/places/server/photo-deps';
import { THUMB_WIDTH } from '@/features/places/services/photo-service';
import { createServerSupabase } from '@/shared/supabase/server';

/** Đủ cho sổ quán của một nhóm; ảnh cũ hơn không cần cho ảnh đại diện. */
const COVER_SCAN_LIMIT = 1000;

/** Ảnh đại diện (ảnh mới nhất) của từng quán trong nhóm: { placeId: thumbUrl }. RLS giới hạn theo nhóm người gọi. */
export async function GET() {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  try {
    const db = await createServerSupabase();
    const deps = createPhotoDeps(db);
    if (!deps) return Response.json({ covers: {} });
    const { data, error } = await db.from('place_photos').select('place_id, file_public_id, file_format').order('created_at', { ascending: false }).limit(COVER_SCAN_LIMIT);
    if (error) throw error;
    const covers: Record<string, string> = {};
    for (const r of data) {
      if (covers[r.place_id] || !r.file_public_id.startsWith(`food-tour/places/${r.place_id}/`)) continue;
      covers[r.place_id] = deps.storage.imageUrl({ publicId: r.file_public_id, format: r.file_format }, { width: THUMB_WIDTH });
    }
    return Response.json({ covers }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
