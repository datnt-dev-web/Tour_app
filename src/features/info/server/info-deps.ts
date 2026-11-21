import 'server-only';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { createCloudinaryStorage } from '@/integrations/cloudinary/client';
import { cloudinaryConfig, getEnv } from '@/shared/config/env';
import type { Db } from '@/shared/supabase/db';
import { createInfosRepo } from '../repositories/infos-repo';
import type { InfoDeps } from '../services/info-service';

/** Ghép phụ thuộc thật theo client phiên người dùng (RLS là chốt chặn cuối). */
export function createInfoDeps(db: Db): InfoDeps {
  const cfg = cloudinaryConfig(getEnv());
  return { infos: createInfosRepo(db), trips: createTripsRepo(db), storage: cfg ? createCloudinaryStorage(cfg) : null };
}

export const isFileUploadEnabled = () => cloudinaryConfig(getEnv()) !== null;
