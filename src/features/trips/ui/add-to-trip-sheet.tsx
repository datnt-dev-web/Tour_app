'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/shared/ui/skeleton';
import { todayInVietnam } from '@/shared/date';
import { splitTrips } from '../services/trips-service';
import { dateRange } from './home-screen';
import { tripsQuery } from './trip-queries';

/** Bottom sheet chọn chuyến sắp đi để thêm chỗ vào. */
export function AddToTripSheet({ groupId, placeName, isAdded, onPick, onClose }: { groupId: string; placeName: string; isAdded: (tripId: string) => boolean; onPick: (tripId: string) => void; onClose: () => void }) {
  const { data, isPending, isError } = useQuery(tripsQuery(groupId));
  const upcoming = data ? splitTrips(data, todayInVietnam()).upcoming : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chọn chuyến"
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex max-h-[70dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-sm bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Thêm vào chuyến nào?</h2>
            <p className="truncate text-sm text-muted">{placeName}</p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center pressable rounded hover:bg-surface">
            <X size={20} aria-hidden />
          </button>
        </div>
        {isPending ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <p className="text-sm text-bad">Không tải được danh sách chuyến, thử lại sau.</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted">
            Chưa có chuyến nào sắp đi.{' '}
            <Link href="/" className="font-semibold text-accent">
              Tạo chuyến mới
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={isAdded(t.id)}
                  onClick={() => onPick(t.id)}
                  className="flex min-h-11 w-full flex-col pressable rounded border border-line bg-white p-3 text-left hover:bg-surface disabled:opacity-60"
                >
                  <span className="font-semibold">
                    {t.name}
                    {isAdded(t.id) && ' · ✓ Đã thêm'}
                  </span>
                  <span className="text-sm text-muted">
                    {t.city}
                    {dateRange(t) && ` · ${dateRange(t)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
