import 'server-only';
import { createValhallaClient } from '@/integrations/valhalla/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import type { LatLng } from '../services/geo';
import { getStopDistances } from '../services/stop-distances';
import { loadTripLocations } from './load-trip-locations';

/**
 * Quãng đường cho tab Hôm nay. Tọa độ các chỗ lấy từ dữ liệu bản đồ của chính chuyến (RLS quyết định thấy được không),
 * client chỉ gửi id, nên không ai dùng được API này để tính đường giữa các điểm tùy ý.
 */
export async function loadStopDistances(groupId: string, tripId: string, ids: string[], origin: LatLng | null) {
  const env = getEnv();
  const wanted = new Set(ids);
  const { points } = await loadTripLocations(groupId, tripId);
  return getStopDistances(
    { routing: createValhallaClient(env.VALHALLA_API_URL, env.ROUTING_COSTING), cache: getCacheStore(), ttlSec: env.ROUTE_TTL_SEC, costing: env.ROUTING_COSTING },
    points.filter((p) => wanted.has(p.tripPlaceId)).map((p) => ({ id: p.tripPlaceId, lat: p.lat, lng: p.lng })),
    origin,
  );
}
