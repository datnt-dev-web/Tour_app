import 'server-only';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { createCloudinaryStorage } from '@/integrations/cloudinary/client';
import { cloudinaryConfig, getEnv } from '@/shared/config/env';
import type { Db } from '@/shared/supabase/db';
import { createTripPhotosRepo } from '../repositories/trip-photos-repo';
import type { MemoriesDeps } from '../services/memories-service';

/** Ghép phụ thuộc thật theo client phiên người dùng (RLS là chốt chặn cuối). */
export function createMemoriesDeps(db: Db): MemoriesDeps {
  const cfg = cloudinaryConfig(getEnv());
  const trips = createTripsRepo(db);
  return { photos: createTripPhotosRepo(db), findTrip: (id) => trips.getTrip(id), storage: cfg ? createCloudinaryStorage(cfg) : null };
}
