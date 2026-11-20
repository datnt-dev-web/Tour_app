import 'server-only';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import { createServerSupabase } from '@/shared/supabase/server';
import { createPlacesRepo } from '../repositories/places-repo';
import { createReviewsRepo } from '../repositories/reviews-repo';
import { getPlaceView } from '../services/place-service';

/** Ghép phụ thuộc thật cho getPlaceView (dùng chung cho trang và API route). Gọi lúc request, không gọi ở top-level module. */
export async function loadPlaceView(groupId: string, placeKey: string) {
  const db = await createServerSupabase();
  return getPlaceView(
    {
      places: createGooglePlacesClient(getEnv().GOOGLE_PLACES_API_KEY),
      cache: getCacheStore(),
      placesRepo: createPlacesRepo(db),
      reviewsRepo: createReviewsRepo(db),
    },
    groupId,
    placeKey,
  );
}
