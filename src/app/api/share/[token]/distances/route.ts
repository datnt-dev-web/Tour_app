import { appErrorResponse, errorResponse } from '@/features/ai/server/ai-request';
import { loadSharedStopDistances } from '@/features/trips/server/load-shared-trip';
import { distancesBodySchema } from '@/features/trips/server/load-stop-distances';

// Lần đầu có thể phải định vị các chỗ (Nominatim ~1 giây/chỗ) trước khi tính đường.
export const maxDuration = 60;

/** "Gần tôi" trên link chia sẻ: không cần đăng nhập, token còn hạn là quyền. POST để vị trí không nằm trên URL / log. */
export async function POST(request: Request, ctx: RouteContext<'/api/share/[token]/distances'>) {
  const { token } = await ctx.params;
  const body = distancesBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return errorResponse('INVALID_INPUT', 'Dữ liệu không hợp lệ.', 400);
  try {
    return Response.json(await loadSharedStopDistances(token, body.data.ids, body.data.origin));
  } catch (e) {
    return appErrorResponse(e);
  }
}
