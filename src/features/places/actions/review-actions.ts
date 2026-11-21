'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createReviewsRepo, type InternalReview } from '../repositories/reviews-repo';

const reviewSchema = z.object({
  placeId: z.uuid(),
  verdict: z.enum(['up', 'down']),
  // Bắt buộc có nội dung (sau khi bỏ khoảng trắng), khớp với nút gửi bị khóa ở client.
  note: z.string().trim().min(1).max(500),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  tripId: z.uuid().optional(),
});

/** Ghi bằng phiên người dùng: RLS kiểm thành viên nhóm và trip cùng nhóm với chỗ. */
export async function addInternalReviewAction(input: z.input<typeof reviewSchema>): Promise<ActionResult<InternalReview>> {
  return runAction(async () => {
    const { db } = await authed();
    return createReviewsRepo(db).addReview(parse(reviewSchema, input));
  });
}
