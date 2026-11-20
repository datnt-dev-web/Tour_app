import { queryOptions } from '@tanstack/react-query';
import { AppError } from '@/shared/errors';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { createTripsRepo } from '../repositories/trips-repo';

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
