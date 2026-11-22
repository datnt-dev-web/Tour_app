import 'server-only';
import { getRequestGroup } from '@/features/groups/server/get-request-group';
import { createCloudinaryStorage } from '@/integrations/cloudinary/client';
import { createYoutubeMetaClient } from '@/integrations/youtube/oembed';
import { cloudinaryConfig, getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import type { Db } from '@/shared/supabase/db';
import { createGroupTracksRepo } from '../repositories/group-tracks-repo';
import { createMusicFoldersRepo } from '../repositories/music-folders-repo';
import type { MusicDeps } from '../services/music-service';

/** Ghép phụ thuộc thật theo client phiên người dùng (RLS là chốt chặn cuối). */
export function createMusicDeps(db: Db): MusicDeps {
  const cfg = cloudinaryConfig(getEnv());
  return { tracks: createGroupTracksRepo(db), folders: createMusicFoldersRepo(db), storage: cfg ? createCloudinaryStorage(cfg) : null, youtube: createYoutubeMetaClient() };
}

/** Nhạc là của nhóm đang chọn (lấy ở server từ phiên + cookie nhóm, client không tự truyền group id). */
export async function currentGroupId(): Promise<string> {
  const ctx = await getRequestGroup();
  if (!ctx) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập.');
  if (!ctx.group) throw new AppError('NO_GROUP', 'Bạn chưa ở nhóm nào.');
  return ctx.group.id;
}
