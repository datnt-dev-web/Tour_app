import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type TripInfo = Database['public']['Tables']['trip_infos']['Row'];
export type NewTripInfo = Omit<Database['public']['Tables']['trip_infos']['Insert'], 'id' | 'created_at' | 'created_by'>;

export interface InfosRepo {
  /** Mới nhất trước. */
  list(tripId: string): Promise<TripInfo[]>;
  get(id: string): Promise<TripInfo | null>;
  count(tripId: string): Promise<number>;
  insert(row: NewTripInfo): Promise<TripInfo>;
  /** Xóa và trả dòng đã xóa (để dọn tệp); null nếu không có hoặc không có quyền. */
  remove(id: string): Promise<TripInfo | null>;
}

export function createInfosRepo(db: Db): InfosRepo {
  return {
    async list(tripId) {
      const { data, error } = await db.from('trip_infos').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async get(id) {
      const { data, error } = await db.from('trip_infos').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async count(tripId) {
      const { count, error } = await db.from('trip_infos').select('id', { count: 'exact', head: true }).eq('trip_id', tripId);
      if (error) throw error;
      return count ?? 0;
    },

    async insert(row) {
      const { data, error } = await db.from('trip_infos').insert(row).select('*').single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { data, error } = await db.from('trip_infos').delete().eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}
