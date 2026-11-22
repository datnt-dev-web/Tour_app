import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { isFileUploadEnabled } from '@/features/info/server/info-deps';
import { createMusicDeps } from '@/features/music/server/music-deps';
import { listMusic } from '@/features/music/services/music-service';
import { MusicScreen } from '@/features/music/ui/music-screen';
import { createServerSupabase } from '@/shared/supabase/server';

// Tab Nhạc: danh sách chung của nhóm, lấy sẵn ở server để mở tab là có ngay.
export default async function MusicPage() {
  const ctx = await getRequestGroup();
  const music = ctx?.group ? await listMusic(createMusicDeps(await createServerSupabase()), ctx.group.id) : { tracks: [], folders: [] };
  return <MusicScreen initial={{ ...music, uploadEnabled: isFileUploadEnabled() }} />;
}
