import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createInfoDeps } from '@/features/info/server/info-deps';
import { listInfos } from '@/features/info/services/info-service';
import { createServerSupabase } from '@/shared/supabase/server';

/** Danh sách thông tin của chuyến (không kèm link tệp: link ký lúc bấm qua /api/infos/[id]/file). */
export async function GET(_request: Request, ctx: RouteContext<'/api/trips/[tripId]/infos'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const { tripId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  try {
    const items = await listInfos(createInfoDeps(await createServerSupabase()), tripId);
    return Response.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
