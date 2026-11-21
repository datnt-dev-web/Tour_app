import 'server-only';
import { createCloudinaryStorage } from '@/integrations/cloudinary/client';
import { cloudinaryConfig, getEnv } from '@/shared/config/env';
import type { Db } from '@/shared/supabase/db';
import { createPhotosRepo } from '../repositories/photos-repo';
import type { PhotoDeps } from '../services/photo-service';

/** null khi chưa cấu hình Cloudinary (ảnh tắt, phần còn lại của app vẫn chạy). */
export function createPhotoDeps(db: Db): PhotoDeps | null {
  const cfg = cloudinaryConfig(getEnv());
  return cfg ? { photos: createPhotosRepo(db), storage: createCloudinaryStorage(cfg) } : null;
}
