import 'server-only';
import { getCacheStore } from '@/shared/cache/get-cache-store';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { createAdminSupabase } from '@/shared/supabase/admin';
import type { LatLng } from '../services/geo';
import { consumeShareDistanceRate, loadSharedTrip } from '../services/share';
import { loadStopDistances } from './load-stop-distances';

/**
 * Chuyến theo link chia sẻ (còn hạn) + các chỗ, trừ chỗ đã bỏ. Người xem không đăng nhập nên dùng service role;
 * token là thứ duy nhất cấp quyền, và chỉ đọc các cột lịch trình (không tiền, không ghi chú).
 */
export async function loadSharedTripByToken(token: string) {
  const admin = createAdminSupabase();
  return loadSharedTrip(
    {
      findByToken: async (t) => {
        const { data } = await admin.from('trips').select('id, group_id, name, city, start_date, end_date, share_expires_at').eq('share_token', t).maybeSingle();
        return data;
      },
      listStops: async (tripId) => {
        const { data } = await admin
          .from('trip_places')
          .select('id, status, visit_date, visit_time, visit_end_time, places(name, address, city, category, google_place_id)')
          .eq('trip_id', tripId)
          .neq('status', 'dropped')
          .order('visit_date', { nullsFirst: false })
          .order('visit_time', { nullsFirst: false });
        return (data ?? []).flatMap((r) => (r.places ? [{ ...r, place: r.places }] : []));
      },
    },
    token,
  );
}

/** "Gần tôi" trên link chia sẻ: kiểm token còn hạn, giới hạn số lần mỗi phút, rồi tính như tab Hôm nay (chỉ trong chuyến đó). */
export async function loadSharedStopDistances(token: string, ids: string[], origin: LatLng | null) {
  const shared = await loadSharedTripByToken(token);
  if (!shared) throw new AppError('NOT_FOUND', 'Link đã hết hạn hoặc không còn tồn tại.');
  await consumeShareDistanceRate(getCacheStore(), token, getEnv().SHARE_DISTANCES_PER_MIN);
  const { trip } = shared;
  return loadStopDistances(trip.group_id, trip.id, ids, origin, createAdminSupabase());
}
