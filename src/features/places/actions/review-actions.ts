'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
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
    const { db } = await authed();
    const { note, ...rest } = parse(reviewSchema, input);
    return createReviewsRepo(db).addReview({ ...rest, note: note || null });
  });
}
