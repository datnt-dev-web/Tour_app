import { z } from 'zod';
import { requireGroup } from '@/features/ai/server/ai-request';
import { exploreSearch } from '@/features/explore/services/explore-service';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { getEnv } from '@/shared/config/env';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { AppError } from '@/shared/errors';

const querySchema = z.object({
  city: z.string().trim().min(1).max(100),
  category: z.enum(['food', 'snack', 'cafe', 'play', 'stay']),
  price: z.coerce.number().int().min(1).max(3).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
});

const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

export async function GET(request: Request) {
  // Chỉ thành viên nhóm mới được tiêu quota Google (người lạ tự đăng ký vẫn có phiên).
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const raw = Object.fromEntries(new URL(request.url).searchParams);
  // Tham số rỗng (vd. price=) coi như không truyền.
  const parsed = querySchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')));
  if (!parsed.success) return errorResponse('INVALID_QUERY', 'Tham số tìm kiếm không hợp lệ.', 400);
  const { city, category, price, minReviews } = parsed.data;

  try {
    const results = await exploreSearch(
      { places: createGooglePlacesClient(getEnv().GOOGLE_PLACES_API_KEY), cache: getCacheStore() },
      { city, category, priceTier: price as 1 | 2 | 3 | undefined, minReviews },
    );
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (e) {
    if (e instanceof AppError) return errorResponse(e.code, e.message, 502);
    throw e;
  }
}
