import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type ReviewVerdict = 'up' | 'down';

export interface InternalReview {
  id: string;
  placeId: string;
  userId: string;
  authorName: string;
  avatarColor: string;
  tripId: string | null;
  verdict: ReviewVerdict;
  note: string | null;
  /** Số sao 1–5, null nếu không chấm. */
  rating: number | null;
  createdAt: string;
}

export interface NewReviewInput {
  placeId: string;
  verdict: ReviewVerdict;
  note: string | null;
  rating?: number | null;
  tripId?: string;
}

export interface ReviewsRepo {
  /** Mới nhất trước. */
  listReviews(placeId: string): Promise<InternalReview[]>;
  /** user_id lấy từ phiên (default auth.uid()); RLS kiểm thành viên nhóm và trip cùng nhóm với chỗ. */
  addReview(input: NewReviewInput): Promise<InternalReview>;
}

type ReviewRow = Database['public']['Tables']['place_reviews_internal']['Row'] & {
  author: { display_name: string; avatar_color: string } | null;
};

const SELECT = '*, author:profiles(display_name, avatar_color)';

function toReview(r: ReviewRow): InternalReview {
  return {
    id: r.id,
    placeId: r.place_id,
    userId: r.user_id,
    authorName: r.author?.display_name ?? 'Thành viên',
    avatarColor: r.author?.avatar_color ?? '#f97316',
    tripId: r.trip_id,
    verdict: r.verdict as ReviewVerdict,
    note: r.note,
    rating: r.rating,
    createdAt: r.created_at,
  };
}

export function createReviewsRepo(db: Db): ReviewsRepo {
  return {
    async listReviews(placeId) {
      const { data, error } = await db
        .from('place_reviews_internal')
        .select(SELECT)
        .eq('place_id', placeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(toReview);
    },

    async addReview({ placeId, verdict, note, rating, tripId }) {
      const { data, error } = await db
        .from('place_reviews_internal')
        .insert({ place_id: placeId, verdict, note, rating: rating ?? null, trip_id: tripId ?? null })
        .select(SELECT)
        .single();
      if (error) throw error;
      return toReview(data);
    },
  };
}
