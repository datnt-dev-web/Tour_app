import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { loadTripLocations } from '@/features/trips/server/load-trip-locations';

export async function GET(_request: Request, ctx: RouteContext<'/api/trips/[tripId]/locations'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const { tripId } = await ctx.params;
  // Id không phải uuid làm Postgres báo lỗi cú pháp; coi như không tìm thấy.
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  try {
    return Response.json(await loadTripLocations(auth.groupId, tripId));
  } catch (e) {
    return appErrorResponse(e);
  }
}
