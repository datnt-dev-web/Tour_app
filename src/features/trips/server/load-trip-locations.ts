import 'server-only';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { createNominatimClient } from '@/integrations/nominatim/client';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv, isGooglePlacesConfigured } from '@/shared/config/env';
import { createServerSupabase } from '@/shared/supabase/server';
import { createTripsRepo } from '../repositories/trips-repo';
import { getTripLocations } from '../services/trip-locations-service';

/** Ghép phụ thuộc thật cho getTripLocations. Dùng Supabase của người gọi nên RLS quyết định chuyến có thấy được không. Gọi lúc request. */
export async function loadTripLocations(groupId: string, tripId: string) {
  const key = getEnv().GOOGLE_PLACES_API_KEY;
  return getTripLocations(
    {
      places: createGooglePlacesClient(key),
      geocoder: createNominatimClient(),
      googleEnabled: isGooglePlacesConfigured(key),
      cache: getCacheStore(),
      tripsRepo: createTripsRepo(await createServerSupabase()),
    },
    groupId,
    tripId,
  );
}
