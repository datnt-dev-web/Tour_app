import 'server-only';
import { createGeocodingClient } from '@/integrations/google-geocoding/client';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import { createServerSupabase } from '@/shared/supabase/server';
import { createTripsRepo } from '../repositories/trips-repo';
import { getTripLocations } from '../services/trip-locations-service';

/** Ghép phụ thuộc thật cho getTripLocations. Dùng Supabase của người gọi nên RLS quyết định chuyến có thấy được không. Gọi lúc request. */
export async function loadTripLocations(groupId: string, tripId: string) {
  const key = getEnv().GOOGLE_PLACES_API_KEY;
  return getTripLocations(
    {
      places: createGooglePlacesClient(key),
      geocoder: createGeocodingClient(key),
      cache: getCacheStore(),
      tripsRepo: createTripsRepo(await createServerSupabase()),
    },
    groupId,
    tripId,
  );
}
