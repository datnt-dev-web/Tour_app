import { queryOptions } from '@tanstack/react-query';
import { AppError } from '@/shared/errors';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { createTripsRepo } from '../repositories/trips-repo';
import type { TripLocations } from '../services/trip-locations-service';

/** Danh sách phẳng; việc tách sắp đi/đã đi làm lúc render để đếm ngược theo ngày hiện tại. */
export const tripsQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.trips(groupId),
    queryFn: () => createTripsRepo(createBrowserSupabase()).listTrips(groupId),
  });

export const tripQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.trip(tripId),
    queryFn: async () => {
      const detail = await createTripsRepo(createBrowserSupabase()).getTripDetail(tripId);
      if (!detail) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
      return detail;
    },
  });

const LOCATIONS_STALE_MS = 5 * 60 * 1000;

/** Điểm bản đồ do server dựng (Google hoặc OSM, cache Redis), nên lấy qua API route thay vì Supabase trực tiếp. */
export const tripLocationsQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripLocations(tripId),
    staleTime: LOCATIONS_STALE_MS,
    queryFn: async (): Promise<TripLocations> => {
      const res = await fetch(`/api/trips/${tripId}/locations`);
      if (res.ok) return (await res.json()) as TripLocations;
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? 'Không tải được bản đồ, thử lại sau.');
    },
  });
