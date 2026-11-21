import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createPhotoDeps } from '@/features/places/server/photo-deps';
import { listPlacePhotos } from '@/features/places/services/photo-service';
import { createServerSupabase } from '@/shared/supabase/server';

/** Ảnh của một quán (?placeId=uuid), kèm link ảnh nhỏ/lớn đã ký. */
export async function GET(request: Request) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const placeId = new URL(request.url).searchParams.get('placeId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) return errorResponse('NOT_FOUND', 'Không tìm thấy quán.', 404);
  try {
    const deps = createPhotoDeps(await createServerSupabase());
    return Response.json({ photos: deps ? await listPlacePhotos(deps, placeId) : [], enabled: !!deps }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
