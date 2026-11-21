import 'server-only';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { createGeminiClient } from '@/integrations/gemini/client';
import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { createAiCacheRepo } from '../repositories/ai-cache-repo';
import type { AiDeps } from '../services/ai-service';

export const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

/** Người gọi phải đăng nhập và đang ở một nhóm (getRequestGroup chỉ trả nhóm mà user là thành viên). */
export async function requireGroup(): Promise<{ groupId: string } | Response> {
  const ctx = await getRequestGroup();
  if (!ctx) return errorResponse('UNAUTHENTICATED', 'Bạn cần đăng nhập.', 401);
  if (!ctx.group) return errorResponse('NO_GROUP', 'Bạn chưa ở nhóm nào.', 403);
  return { groupId: ctx.group.id };
}

/** Ghép phụ thuộc thật; gọi lúc request, không gọi ở top-level module. */
export function createAiDeps(): AiDeps {
  const env = getEnv();
  return {
    gemini: createGeminiClient(env.GEMINI_API_KEY, env.GEMINI_MODEL),
    places: createGooglePlacesClient(env.GOOGLE_PLACES_API_KEY),
    aiCache: createAiCacheRepo(createAdminSupabase()),
    quota: getCacheStore(),
  };
}

const STATUS_BY_CODE: Record<string, number> = { AI_QUOTA: 429, AI_UNUSABLE: 502, AI_UNAVAILABLE: 503, PLACES_UNAVAILABLE: 502, GEO_UNAVAILABLE: 503, GEOCODE_UNAVAILABLE: 503, EXPLORE_UNAVAILABLE: 503, NOT_FOUND: 404 };

/** Đổi AppError đã biết thành JSON lỗi; lỗi lạ ném lại để Next trả 500. */
export function appErrorResponse(e: unknown): Response {
  if (e instanceof AppError) return errorResponse(e.code, e.message, STATUS_BY_CODE[e.code] ?? 502);
  throw e;
}
