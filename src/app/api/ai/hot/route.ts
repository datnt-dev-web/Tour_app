import { z } from 'zod';
import { appErrorResponse, createAiDeps, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { findHotPlaces } from '@/features/ai/services/ai-service';

const bodySchema = z.object({
  city: z.string().trim().min(1).max(100),
  category: z.enum(['food', 'snack', 'cafe', 'play', 'stay']),
});

export async function POST(request: Request) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 400);

  try {
    return Response.json({ places: await findHotPlaces(createAiDeps(), auth.groupId, parsed.data) });
  } catch (e) {
    return appErrorResponse(e);
  }
}
