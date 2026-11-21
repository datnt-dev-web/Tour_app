import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createMemoriesDeps } from '@/features/memories/server/memories-deps';
import { listMemories } from '@/features/memories/services/memories-service';
import { isFileUploadEnabled } from '@/features/info/server/info-deps';
import { createServerSupabase } from '@/shared/supabase/server';

/** Ảnh kỉ niệm của chuyến (mới nhất trước); link tải gốc có hạn nên không cache. */
export async function GET(_request: Request, ctx: RouteContext<'/api/trips/[tripId]/photos'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const { tripId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  try {
    const photos = await listMemories(createMemoriesDeps(await createServerSupabase()), tripId);
    return Response.json({ photos, enabled: isFileUploadEnabled() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
