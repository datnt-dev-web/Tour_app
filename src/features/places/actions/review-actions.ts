'use server';

import { z } from 'zod';
import { runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { createServerSupabase } from '@/shared/supabase/server';
import { createReviewsRepo, type InternalReview } from '../repositories/reviews-repo';

const reviewSchema = z.object({
  placeId: z.uuid(),
  verdict: z.enum(['up', 'down']),
  note: z.string().trim().max(500),
  tripId: z.uuid().optional(),
});

/** Ghi bằng phiên người dùng: RLS kiểm thành viên nhóm và trip cùng nhóm với chỗ. */
export async function addInternalReviewAction(input: z.input<typeof reviewSchema>): Promise<ActionResult<InternalReview>> {
  return runAction(async () => {
    const db = await createServerSupabase();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập.');
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Dữ liệu không hợp lệ.');
    const { note, ...rest } = parsed.data;
    return createReviewsRepo(db).addReview({ ...rest, note: note || null });
  });
}
