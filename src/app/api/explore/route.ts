import { z } from 'zod';
import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { exploreNearby } from '@/features/explore/services/nearby-service';
import { STORED_CATEGORIES } from '@/features/places/constants';
import { createNominatimClient } from '@/integrations/nominatim/client';
import { createOverpassClient } from '@/integrations/overpass/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';

// Overpass có thể chậm vài giây khi máy chủ bận.
export const maxDuration = 30;

const querySchema = z
  .object({
    category: z.enum(STORED_CATEGORIES),
    city: z.string().trim().min(1).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((q) => q.city || (q.lat !== undefined && q.lng !== undefined));

/** Khám phá: chỗ trên OpenStreetMap quanh vị trí (lat,lng) hoặc trung tâm thành phố. */
export async function GET(request: Request) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const raw = Object.fromEntries([...new URL(request.url).searchParams].filter(([, v]) => v !== ''));
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return errorResponse('INVALID_QUERY', 'Tham số tìm kiếm không hợp lệ.', 400);
  const { category, city, lat, lng } = parsed.data;

  try {
    const result = await exploreNearby(
      { osm: createOverpassClient({ url: getEnv().OVERPASS_API_URL }), geocoder: createNominatimClient(), cache: getCacheStore() },
      { category, ...(lat !== undefined && lng !== undefined ? { at: { lat, lng } } : { city }) },
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
