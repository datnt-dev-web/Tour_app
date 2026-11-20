import type { PlaceCandidate, PlaceCategory } from '@/integrations/google-places/types';
import { normalizeText } from '@/shared/text';
import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type Place = Database['public']['Tables']['places']['Row'];
/** Loại lưu trong DB: các loại tìm được trên Google cộng 'gift' (thêm tay). */
export type StoredPlaceCategory = PlaceCategory | 'gift';

/** Dòng sổ quán thô: chỗ kèm mọi đánh giá nội bộ (service chọn đánh giá mới nhất). */
export type BookPlaceRaw = Place & {
  place_reviews_internal: { verdict: string; note: string | null; created_at: string }[];
};

export type PlaceRef = { id: string } | { googlePlaceId: string };

export interface PlacesRepo {
  findPlace(groupId: string, ref: PlaceRef): Promise<Place | null>;
  listBookPlaces(groupId: string): Promise<BookPlaceRaw[]>;
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
    async findPlace(groupId, ref) {
      const q = db.from('places').select('*').eq('group_id', groupId);
      const { data, error } = await ('id' in ref ? q.eq('id', ref.id) : q.eq('google_place_id', ref.googlePlaceId)).maybeSingle();
      if (error) throw error;
      return data;
    },

    async listBookPlaces(groupId) {
      const { data, error } = await db
        .from('places')
        .select('*, place_reviews_internal(verdict, note, created_at)')
        .eq('group_id', groupId)
        .order('name');
      if (error) throw error;
      return data;
    },

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
          verified: true, // có google id nghĩa là đã đối chiếu Google Maps
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
