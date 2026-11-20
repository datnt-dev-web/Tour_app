import { errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { getAiStatus } from '@/features/ai/services/ai-service';
import { getCacheStore } from '@/shared/cache/get-cache-store';

/** Số lượt AI còn lại hôm nay của nhóm hiện tại, để UI hiện "còn N/10" và khóa nút khi hết. */
export async function GET() {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  try {
    return Response.json(await getAiStatus(getCacheStore(), auth.groupId));
  } catch {
    return errorResponse('AI_UNAVAILABLE', 'Không đọc được số lượt AI.', 503);
  }
}
