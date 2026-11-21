import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type TripPhoto = Database['public']['Tables']['trip_photos']['Row'];
export type NewTripPhoto = Pick<TripPhoto, 'trip_id' | 'file_public_id' | 'file_format' | 'width' | 'height'>;

export interface TripPhotosRepo {
  /** Mới nhất trước. */
  list(tripId: string): Promise<TripPhoto[]>;
  count(tripId: string): Promise<number>;
  insert(row: NewTripPhoto): Promise<TripPhoto>;
  /** Xóa và trả dòng đã xóa (để dọn Cloudinary); null nếu không có hoặc không có quyền. */
  remove(id: string): Promise<TripPhoto | null>;
}

/** db là client theo phiên người dùng: RLS chặn chuyến của nhóm khác. */
export function createTripPhotosRepo(db: Db): TripPhotosRepo {
  return {
    async list(tripId) {
      const { data, error } = await db.from('trip_photos').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async count(tripId) {
      const { count, error } = await db.from('trip_photos').select('id', { count: 'exact', head: true }).eq('trip_id', tripId);
      if (error) throw error;
      return count ?? 0;
    },
    async insert(row) {
      const { data, error } = await db.from('trip_photos').insert(row).select('*').single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { data, error } = await db.from('trip_photos').delete().eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}
