'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { addInternalReviewAction } from '../actions/review-actions';
import type { InternalReview } from '../repositories/reviews-repo';
import type { BookRow } from '../services/book-service';
import type { PlaceView } from '../services/place-service';
import { bookPrefix, bookQuery } from './book-queries';

type Vars = Parameters<typeof addInternalReviewAction>[0];

/** Thêm đánh giá nội bộ; sửa lạc quan màn chỗ và sổ quán, hoàn tác nếu lỗi, xong thì làm mới. */
export function useAddReview(groupId: string, placeKey: string) {
  const qc = useQueryClient();
  const placeKeyQ = queryKeys.place(placeKey);
  const bookKeyQ = bookQuery(groupId).queryKey;

  return useMutation({
    mutationFn: async (v: Vars) => unwrap(await addInternalReviewAction(v)),
    onMutate: async (v) => {
      await Promise.all([qc.cancelQueries({ queryKey: placeKeyQ }), qc.cancelQueries({ queryKey: bookKeyQ })]);
      const previous = { place: qc.getQueryData<PlaceView>(placeKeyQ), book: qc.getQueryData<BookRow[]>(bookKeyQ) };
      const optimistic: InternalReview = {
        id: `optimistic-${Date.now()}`,
        placeId: v.placeId,
        userId: '',
        authorName: 'Bạn',
        avatarColor: '#f97316',
        tripId: v.tripId ?? null,
        verdict: v.verdict,
        note: v.note.trim() || null,
        rating: v.rating ?? null,
        createdAt: new Date().toISOString(),
      };
      if (previous.place) qc.setQueryData<PlaceView>(placeKeyQ, { ...previous.place, reviews: [optimistic, ...previous.place.reviews] });
      if (previous.book) {
        qc.setQueryData<BookRow[]>(
          bookKeyQ,
          previous.book.map((r) => (r.placeId === v.placeId ? { ...r, verdict: v.verdict, note: optimistic.note } : r)),
        );
      }
      return previous;
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.place) qc.setQueryData(placeKeyQ, ctx.place);
      if (ctx?.book) qc.setQueryData(bookKeyQ, ctx.book);
    },
    onSettled: () =>
      Promise.all([qc.invalidateQueries({ queryKey: placeKeyQ }), qc.invalidateQueries({ queryKey: bookPrefix(groupId) })]),
  });
}
