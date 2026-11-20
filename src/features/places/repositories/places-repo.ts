import type { PlaceCandidate, PlaceCategory } from '@/integrations/google-places/types';
import { normalizeText } from '@/shared/text';
import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type Place = Database['public']['Tables']['places']['Row'];
/** Loại lưu trong DB: các loại tìm được trên Google cộng 'gift' (thêm tay). */
export type StoredPlaceCategory = PlaceCategory | 'gift';

export interface PlacesRepo {
  /** Chưa có (group_id, google_place_id) thì tạo; có rồi thì trả dòng cũ, không ghi đè dữ liệu nhóm đã có. */
  upsertPlaceFromGoogle(
    groupId: string,
    c: PlaceCandidate,
    category: StoredPlaceCategory,
    city: string,
    userId: string,
  ): Promise<Place>;
}

export function createPlacesRepo(db: Db): PlacesRepo {
  return {
    async upsertPlaceFromGoogle(groupId, c, category, city, userId) {
      const { error } = await db.from('places').upsert(
        {
          group_id: groupId,
          google_place_id: c.googlePlaceId,
          name: c.name,
          address: c.address,
          city,
          city_norm: normalizeText(city),
          category,
          maps_url: c.mapsUrl,
          created_by: userId,
        },
        { onConflict: 'group_id,google_place_id', ignoreDuplicates: true },
      );
      if (error) throw error;
      const { data, error: selectError } = await db
        .from('places')
        .select('*')
        .eq('group_id', groupId)
        .eq('google_place_id', c.googlePlaceId)
        .single();
      if (selectError) throw selectError;
      return data;
    },
  };
}
