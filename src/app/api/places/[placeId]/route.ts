import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { loadPlaceView } from '@/features/places/server/load-place-view';
import { AppError } from '@/shared/errors';

const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

export async function GET(_request: Request, ctx: RouteContext<'/api/places/[placeId]'>) {
  const request = await getRequestGroup();
  if (!request) return errorResponse('UNAUTHENTICATED', 'Bạn cần đăng nhập.', 401);
  if (!request.group) return errorResponse('NO_GROUP', 'Bạn chưa ở nhóm nào.', 403);

  const { placeId } = await ctx.params;
  try {
    return Response.json(await loadPlaceView(request.group.id, decodeURIComponent(placeId)));
  } catch (e) {
    if (e instanceof AppError) return errorResponse(e.code, e.message, e.code === 'NOT_FOUND' ? 404 : 502);
    throw e;
  }
}
