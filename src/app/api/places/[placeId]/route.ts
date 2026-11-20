import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { loadPlaceView } from '@/features/places/server/load-place-view';
import { decodePlaceKey } from '@/features/places/services/place-service';
import { AppError } from '@/shared/errors';

const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

export async function GET(_request: Request, ctx: RouteContext<'/api/places/[placeId]'>) {
  const request = await getRequestGroup();
  if (!request) return errorResponse('UNAUTHENTICATED', 'Bạn cần đăng nhập.', 401);
  if (!request.group) return errorResponse('NO_GROUP', 'Bạn chưa ở nhóm nào.', 403);

  const { placeId } = await ctx.params;
  const placeKey = decodePlaceKey(placeId);
  if (!placeKey) return errorResponse('NOT_FOUND', 'Không tìm thấy chỗ này.', 404);
  try {
    return Response.json(await loadPlaceView(request.group.id, placeKey));
  } catch (e) {
    if (e instanceof AppError) return errorResponse(e.code, e.message, e.code === 'NOT_FOUND' ? 404 : 502);
    throw e;
  }
}
