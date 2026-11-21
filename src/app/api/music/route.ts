import { appErrorResponse, requireGroup } from '@/features/ai/server/ai-request';
import { isFileUploadEnabled } from '@/features/info/server/info-deps';
import { createMusicDeps } from '@/features/music/server/music-deps';
import { listTracks } from '@/features/music/services/music-service';
import { createServerSupabase } from '@/shared/supabase/server';

/** Danh sách nhạc chung của nhóm đang chọn. */
export async function GET() {
  const auth = await requireGroup();
  if (auth instanceof Response) return auth;
  try {
    const tracks = await listTracks(createMusicDeps(await createServerSupabase()), auth.groupId);
    return Response.json({ tracks, uploadEnabled: isFileUploadEnabled() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return appErrorResponse(e);
  }
}
