'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Sheet } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { todayInVietnam } from '@/shared/date';
import { splitTrips } from '../services/trips-service';
import { dateRange } from '../services/timeline';
import { tripsQuery } from './trip-queries';

/** Bottom sheet chọn chuyến sắp đi để thêm chỗ vào. */
export function AddToTripSheet({ groupId, placeName, isAdded, onPick, onClose }: { groupId: string; placeName: string; isAdded: (tripId: string) => boolean; onPick: (tripId: string) => void; onClose: () => void }) {
  const { data, isPending, isError } = useQuery(tripsQuery(groupId));
  const upcoming = data ? splitTrips(data, todayInVietnam()).upcoming : [];

  return (
    <Sheet title="Thêm vào chuyến nào?" description={<p className="truncate">{placeName}</p>} onClose={onClose} height="md">
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
                className="flex min-h-11 w-full flex-col pressable rounded border border-line bg-card p-3 text-left hover:bg-surface disabled:opacity-60"
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
    </Sheet>
  );
}
