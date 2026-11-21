import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { tripWeather } from '@/features/trips/services/weather';
import { createNominatimClient } from '@/integrations/nominatim/client';
import { createOpenMeteoClient } from '@/integrations/open-meteo/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { todayInVietnam } from '@/shared/date';
import { createServerSupabase } from '@/shared/supabase/server';

/** Thời tiết từng ngày của chuyến (Open-Meteo, cache 3 giờ); ngày ngoài 16 ngày tới không có. */
export async function GET(_request: Request, ctx: RouteContext<'/api/trips/[tripId]/weather'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const { tripId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
  try {
    const trip = await createTripsRepo(await createServerSupabase()).getTrip(tripId);
    if (!trip) return errorResponse('NOT_FOUND', 'Không tìm thấy chuyến đi.', 404);
    const days = await tripWeather({ geocoder: createNominatimClient(), weather: createOpenMeteoClient(), cache: getCacheStore() }, trip, todayInVietnam());
    return Response.json({ days }, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
