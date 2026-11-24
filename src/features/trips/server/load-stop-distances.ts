import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createValhallaClient } from '@/integrations/valhalla/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import type { Database } from '@/shared/supabase/database.types';
import { DISTANCES_MAX_STOPS } from '../constants';
import type { LatLng } from '../services/geo';
import { getStopDistances } from '../services/stop-distances';
import { loadTripLocations } from './load-trip-locations';

/** Body của các API quãng đường (tab Hôm nay và link chia sẻ): id các chỗ + vị trí đã làm tròn. */
export const distancesBodySchema = z.object({
  ids: z.array(z.uuid()).max(DISTANCES_MAX_STOPS),
  origin: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
});

/**
 * Quãng đường cho tab Hôm nay và link chia sẻ. Tọa độ các chỗ lấy từ dữ liệu bản đồ của chính chuyến (RLS quyết định thấy được không),
 * client chỉ gửi id, nên không ai dùng được API này để tính đường giữa các điểm tùy ý.
 */
export async function loadStopDistances(groupId: string, tripId: string, ids: string[], origin: LatLng | null, db?: SupabaseClient<Database>) {
  const env = getEnv();
  const wanted = new Set(ids);
  const { points } = await loadTripLocations(groupId, tripId, db);
  return getStopDistances(
    { routing: createValhallaClient(env.VALHALLA_API_URL, env.ROUTING_COSTING), cache: getCacheStore(), ttlSec: env.ROUTE_TTL_SEC, costing: env.ROUTING_COSTING },
    points.filter((p) => wanted.has(p.tripPlaceId)).map((p) => ({ id: p.tripPlaceId, lat: p.lat, lng: p.lng })),
    origin,
  );
}
