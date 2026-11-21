import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type PlacePhoto = Database['public']['Tables']['place_photos']['Row'];
export type NewPlacePhoto = Omit<PlacePhoto, 'id' | 'created_at' | 'user_id'>;

export interface PhotosRepo {
  /** Quán có đọc được bằng quyền người gọi không (RLS theo nhóm). */
  placeExists(placeId: string): Promise<boolean>;
  /** Mới nhất trước. */
  list(placeId: string): Promise<PlacePhoto[]>;
  insert(row: NewPlacePhoto): Promise<PlacePhoto>;
  /** Xóa và trả dòng đã xóa (để dọn Cloudinary); null nếu không có hoặc không có quyền. */
  remove(id: string): Promise<PlacePhoto | null>;
}

export function createPhotosRepo(db: Db): PhotosRepo {
  return {
    async placeExists(placeId) {
      const { data, error } = await db.from('places').select('id').eq('id', placeId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    async list(placeId) {
      const { data, error } = await db.from('place_photos').select('*').eq('place_id', placeId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async insert(row) {
      const { data, error } = await db.from('place_photos').insert(row).select('*').single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { data, error } = await db.from('place_photos').delete().eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}
