import { z } from 'zod';
import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { suggestPlaces } from '@/features/geo/services/suggest-service';
import { createPhotonClient } from '@/integrations/photon/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';

const querySchema = z.object({
  q: z.string().max(120),
  kind: z.enum(['address', 'city']),
  city: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('INVALID_QUERY', 'Tham số gợi ý không hợp lệ.', 400);
  try {
    const suggestions = await suggestPlaces({ client: createPhotonClient(), cache: getCacheStore(), ttlSec: getEnv().GEO_SUGGEST_TTL_SEC }, parsed.data);
    return Response.json({ suggestions }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
