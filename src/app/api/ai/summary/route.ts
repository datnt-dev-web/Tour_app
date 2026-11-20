import { z } from 'zod';
import { appErrorResponse, createAiDeps, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { getPlaceSummary } from '@/features/ai/services/ai-service';
import { loadPlaceView } from '@/features/places/server/load-place-view';

const bodySchema = z.object({ placeKey: z.string().trim().min(1).max(300) });

export async function POST(request: Request) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 400);

  try {
    // Chỉ chỗ nhóm đã lưu hoặc Google id mới qua được loadPlaceView.
    const view = await loadPlaceView(auth.groupId, parsed.data.placeKey);
    const name = view.details?.name ?? view.place?.name;
    if (!view.googlePlaceId || !name) return errorResponse('AI_NEEDS_GOOGLE', 'Chỗ chưa xác minh nên chưa tóm tắt được.', 400);
    const summary = await getPlaceSummary(createAiDeps(), auth.groupId, {
      googlePlaceId: view.googlePlaceId,
      name,
      city: view.place?.city ?? '',
      address: view.details?.address ?? view.place?.address ?? '',
    });
    return Response.json(summary);
  } catch (e) {
    return appErrorResponse(e);
  }
}
