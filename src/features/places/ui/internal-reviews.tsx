'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { VERDICT_LABELS } from '../constants';
import type { InternalReview, ReviewVerdict } from '../repositories/reviews-repo';
import { useAddReview } from './use-add-review';
import { VerdictBadge } from './verdict-badge';

const NOTE_MAX = 500;

function ReviewForm({ groupId, placeKey, placeId, tripId }: { groupId: string; placeKey: string; placeId: string; tripId?: string }) {
  const [verdict, setVerdict] = useState<ReviewVerdict>('up');
  const [note, setNote] = useState('');
  const add = useAddReview(groupId, placeKey);

  return (
    <form
      className="flex flex-col gap-2 rounded border border-line bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate({ placeId, verdict, note, tripId }, { onSuccess: () => setNote('') });
      }}
    >
      <div className="flex gap-2" role="group" aria-label="Nhóm thấy chỗ này thế nào">
        {(['up', 'down'] as const).map((v) => (
          <Chip key={v} selected={verdict === v} onClick={() => setVerdict(v)}>
            {v === 'up' ? <ThumbsUp size={16} aria-hidden /> : <ThumbsDown size={16} aria-hidden />}
            {VERDICT_LABELS[v]}
          </Chip>
        ))}
      </div>
      <textarea
        aria-label="Ghi chú"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú ngắn: món nên gọi, giá, thái độ..."
        rows={2}
        className="w-full rounded border border-line bg-white p-3 text-sm"
      />
      {add.error && (
        <p role="alert" className="text-sm text-bad">
          {add.error.message}
        </p>
      )}
      <Button type="submit" disabled={add.isPending}>
        Gửi đánh giá
      </Button>
    </form>
  );
}

/** "Nhóm nói gì": đánh giá nội bộ + form thêm. placeId null nghĩa là nhóm chưa lưu chỗ này nên chưa đánh giá được. */
export function InternalReviews({
  reviews,
  groupId,
  placeKey,
  placeId,
  tripId,
}: {
  reviews: InternalReview[];
  groupId: string;
  placeKey: string;
  placeId: string | null;
  tripId?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold">Nhóm nói gì</h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">Nhóm chưa có đánh giá nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reviews.map((r) => (
            <li key={r.id} className="flex gap-3 rounded border border-line bg-white p-3">
              <span
                aria-hidden
                style={{ backgroundColor: r.avatarColor }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              >
                {r.authorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {r.authorName}
                  <VerdictBadge verdict={r.verdict} />
                </p>
                {r.note && <p className="mt-1 text-sm text-muted">{r.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {placeId ? (
        <ReviewForm groupId={groupId} placeKey={placeKey} placeId={placeId} tripId={tripId} />
      ) : (
        <p className="text-sm text-muted">Thêm chỗ này vào một chuyến để nhóm có thể đánh giá.</p>
      )}
    </section>
  );
}
