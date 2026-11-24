import { z } from 'zod';
import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { DISTANCES_MAX_STOPS } from '@/features/trips/constants';
import { loadStopDistances } from '@/features/trips/server/load-stop-distances';

// Lần đầu có thể phải định vị các chỗ (Nominatim ~1 giây/chỗ) trước khi tính đường.
export const maxDuration = 60;

const bodySchema = z.object({
  ids: z.array(z.uuid()).max(DISTANCES_MAX_STOPS),
  origin: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
});

/** POST vì gửi kèm vị trí (không để vị trí nằm trên URL / log truy cập). */
export async function POST(request: Request, ctx: RouteContext<'/api/trips/[tripId]/distances'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const { tripId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return errorResponse('INVALID_INPUT', 'Dữ liệu không hợp lệ.', 400);
  try {
    return Response.json(await loadStopDistances(auth.groupId, tripId, body.data.ids, body.data.origin));
  } catch (e) {
    return appErrorResponse(e);
  }
}
