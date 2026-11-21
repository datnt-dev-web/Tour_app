'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/shared/actions';
import { formatDayMonth } from '@/shared/date';
import { queryKeys } from '@/shared/query/keys';
import { Button } from '@/shared/ui/button';
import { createShareLinkAction, revokeShareLinkAction } from '../actions/share-actions';
import { SHARE_TTL_DAYS } from '../services/share';
import type { Trip } from '../repositories/trips-repo';

const linkOf = (token: string) => `${window.location.origin}/s/${token}`;

/** Nút "Chia sẻ": tạo link chỉ xem lịch trình (không tiền, không ghi chú), hết hạn sau 30 ngày, thu hồi được. */
export function ShareButton({ trip }: { trip: Trip }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Hết hạn thì trang /s báo không tìm thấy; tạo link mới để gia hạn.
  const active = trip.share_token;
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
  const create = useMutation({ mutationFn: async () => unwrap(await createShareLinkAction({ tripId: trip.id })), onSuccess: refresh });
  const revoke = useMutation({ mutationFn: async () => unwrap(await revokeShareLinkAction({ tripId: trip.id })), onSuccess: refresh });
  const token = create.data?.token ?? active;
  const expiresAt = create.data?.expiresAt ?? trip.share_expires_at;

  async function share() {
    if (!token) return;
    const url = linkOf(token);
    // Điện thoại: mở bảng chia sẻ của hệ thống (Zalo, Messenger…); máy tính: chép link.
    if (navigator.share) {
      await navigator.share({ title: `Lịch trình ${trip.city}`, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Chia sẻ lịch trình"
        title="Chia sẻ lịch trình"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded border border-line bg-card text-ink pressable hover:bg-surface"
      >
        <Share2 size={18} aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chia sẻ lịch trình"
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up flex w-full max-w-[480px] flex-col gap-3 rounded-sm bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Chia sẻ lịch trình</h2>
                <p className="text-sm text-muted">Người có link xem được giờ và chỗ đi, không thấy tiền, ghi chú hay tệp. Link hết hạn sau {SHARE_TTL_DAYS} ngày.</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="inline-flex size-11 shrink-0 items-center justify-center rounded pressable hover:bg-surface">
                <X size={20} aria-hidden />
              </button>
            </div>
            {token ? (
              <>
                <p className="break-all rounded bg-surface p-2 text-sm">{linkOf(token)}</p>
                {expiresAt && <p className="text-xs text-muted">Hết hạn ngày {formatDayMonth(expiresAt.slice(0, 10))}</p>}
                <div className="flex gap-2">
                  <Button onClick={() => void share()} className="flex-1">
                    <Copy size={16} aria-hidden />
                    {copied ? 'Đã chép link' : 'Gửi link'}
                  </Button>
                  <Button variant="secondary" onClick={() => revoke.mutate(undefined, { onSuccess: () => create.reset() })} disabled={revoke.isPending}>
                    Thu hồi
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? 'Đang tạo…' : 'Tạo link chỉ xem'}
              </Button>
            )}
            {(create.error ?? revoke.error) && <p className="text-sm text-bad">{(create.error ?? revoke.error)!.message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
