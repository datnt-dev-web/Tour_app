import { errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { buildTripIcs } from '@/features/trips/services/calendar';
import { createServerSupabase } from '@/shared/supabase/server';

/** Lịch trình dạng .ics (mỗi chỗ đã xếp giờ có nhắc trước), mở bằng Google Calendar / Lịch iPhone. */
export async function GET(_request: Request, ctx: RouteContext<'/api/trips/[tripId]/calendar'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const { tripId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  const detail = await createTripsRepo(await createServerSupabase()).getTripDetail(tripId);
  if (!detail) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  const stops = detail.items.filter((i) => i.status !== 'dropped');
  return new Response(buildTripIcs(detail.trip, stops), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="lich-trinh-${tripId.slice(0, 8)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
