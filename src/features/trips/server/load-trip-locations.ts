import 'server-only';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { createNominatimClient } from '@/integrations/nominatim/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv, isGooglePlacesConfigured } from '@/shared/config/env';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/supabase/database.types';
import { createServerSupabase } from '@/shared/supabase/server';
import { createTripsRepo } from '../repositories/trips-repo';
import { getTripLocations } from '../services/trip-locations-service';

/**
 * Ghép phụ thuộc thật cho getTripLocations. Mặc định dùng Supabase của người gọi nên RLS quyết định chuyến có thấy được không.
 * `db` chỉ truyền khi quyền đã được kiểm ở chỗ khác (link chia sẻ còn hạn). Gọi lúc request.
 */
export async function loadTripLocations(groupId: string, tripId: string, db?: SupabaseClient<Database>) {
  const key = getEnv().GOOGLE_PLACES_API_KEY;
  return getTripLocations(
    {
      places: createGooglePlacesClient(key),
      geocoder: createNominatimClient(),
      googleEnabled: isGooglePlacesConfigured(key),
      cache: getCacheStore(),
      tripsRepo: createTripsRepo(db ?? (await createServerSupabase())),
    },
    groupId,
    tripId,
  );
}
