import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { AppError } from '@/shared/errors';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { useQuery } from '@/shared/query/use-query';
import { createSettleRepo } from '../repositories/settle-repo';
import { createTripsRepo, type StopsQuery } from '../repositories/trips-repo';
import type { LatLng } from '../services/geo';
import type { StopDistances } from '../services/stop-distances';
import type { TripLocations } from '../services/trip-locations-service';

/** Danh sách phẳng; việc tách sắp đi/đã đi làm lúc render để đếm ngược theo ngày hiện tại. */
export const tripsQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.trips(groupId),
    queryFn: () => createTripsRepo(createBrowserSupabase()).listTrips(groupId),
  });

/** Thông tin chuyến + chi phí khác (đầu màn chuyến). */
export const tripQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.trip(tripId),
    queryFn: async () => {
      const info = await createTripsRepo(createBrowserSupabase()).getTripInfo(tripId);
      if (!info) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
      return info;
    },
  });

/** Người xem có sửa được tiền không (admin nhóm). Database vẫn là nơi chặn cuối; đây chỉ để ẩn ô sửa. */
export function useCanEditMoney(tripId: string): boolean {
  return useQuery({ ...tripQuery(tripId), select: (info) => info.canEditMoney === true }).data ?? false;
}

/** Một trang chỗ (lọc, sắp, phân trang ở database). Giữ trang cũ trong lúc tải trang mới để khỏi nháy. */
export const tripStopsQuery = (tripId: string, query: StopsQuery) =>
  queryOptions({
    queryKey: queryKeys.tripStops(tripId, query),
    queryFn: () => createTripsRepo(createBrowserSupabase()).listStops(tripId, query),
    placeholderData: keepPreviousData,
  });

/** Số liệu thống kê cộng ở database (hàm trip_stats). */
export const tripStatsQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripStats(tripId),
    queryFn: async () => {
      const stats = await createTripsRepo(createBrowserSupabase()).getTripStats(tripId);
      if (!stats) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
      return stats;
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

const DISTANCES_STALE_MS = 10 * 60 * 1000;

/** Quãng đường đi thật (server gọi Valhalla, cache). `origin` đã làm tròn ô lưới nên đi trong một ô không tải lại. */
export const stopDistancesQuery = (tripId: string, ids: string[], origin: LatLng | null) =>
  queryOptions({
    queryKey: queryKeys.tripDistances(tripId, origin ? `${origin.lat},${origin.lng}` : '', ids),
    staleTime: DISTANCES_STALE_MS,
    enabled: ids.length > 0,
    queryFn: async (): Promise<StopDistances> => {
      const res = await fetch(`/api/trips/${tripId}/distances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, origin }),
      });
      if (res.ok) return (await res.json()) as StopDistances;
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? 'Không tính được quãng đường, thử lại sau.');
    },
  });

/** Dữ liệu chia tiền: người tham gia, các khoản có tiền kèm người trả, các lần chuyển. */
export const tripSplitQuery = (tripId: string) =>
  queryOptions({ queryKey: queryKeys.tripSplit(tripId), queryFn: () => createSettleRepo(createBrowserSupabase()).splitData(tripId) });
