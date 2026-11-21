import { appErrorResponse, errorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { createInfoDeps } from '@/features/info/server/info-deps';
import { fileLink } from '@/features/info/services/info-service';
import { getEnv } from '@/shared/config/env';
import { createServerSupabase } from '@/shared/supabase/server';

/** Mở/tải tệp: kiểm quyền (RLS) rồi chuyển hướng tới link Cloudinary ký mới, hết hạn sau INFO_FILE_URL_TTL_SEC. */
export async function GET(request: Request, ctx: RouteContext<'/api/infos/[id]/file'>) {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorResponse('NOT_FOUND', 'Không tìm thấy tệp.', 404);
  const download = new URL(request.url).searchParams.get('download') === '1';
  try {
    const url = await fileLink(createInfoDeps(await createServerSupabase()), id, download, getEnv().INFO_FILE_URL_TTL_SEC);
    return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
