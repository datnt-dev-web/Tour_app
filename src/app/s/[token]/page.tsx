import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasRealAddress } from '@/features/places/constants';
import { loadSharedTripByToken } from '@/features/trips/server/load-shared-trip';
import type { ShareStop } from '@/features/trips/services/shared-schedule';
import { dateRange, toHHMM, tripDays } from '@/features/trips/services/timeline';
import { SharedSchedule } from '@/features/trips/ui/shared-schedule';
import { addressDirectionsUrl } from '@/features/trips/ui/trip-view';
import { AppFrame } from '@/shared/ui/app-frame';

// Link riêng tư: không cho máy tìm kiếm lập chỉ mục, luôn đọc mới (thu hồi là mất ngay).
export const metadata: Metadata = { title: 'Lịch trình chuyến đi', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** "23–24.11" (cùng tháng) hoặc "30.11–02.12". */
function stampDates(start: string, end: string | null): string {
  const [, sm, sd] = start.split('-');
  if (!end || end === start) return `${sd}.${sm}`;
  const [, em, ed] = end.split('-');
  return sm === em ? `${sd}–${ed}.${sm}` : `${sd}.${sm}–${ed}.${em}`;
}

/** Trang chỉ xem lịch trình cho người ngoài nhóm: không tiền, không ghi chú, không thông tin nội bộ. */
export default async function SharedTripPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  const shared = await loadSharedTripByToken(token);
  if (!shared) notFound();
  const { trip } = shared;

  const stops: ShareStop[] = shared.stops.map((s) => ({
    id: s.id,
    name: s.place.name,
    address: hasRealAddress(s.place.address) ? s.place.address : null,
    category: s.place.category,
    date: s.visit_date,
    start: s.visit_time ? toHHMM(s.visit_time) : null,
    end: s.visit_end_time ? toHHMM(s.visit_end_time) : null,
    visited: s.status === 'visited',
    directions: addressDirectionsUrl(s.place),
  }));
  const dayCount = tripDays(trip).length;

  return (
    <AppFrame>
      <main className="flex flex-col gap-7 px-4 pt-6 pb-12">
        <header className="relative flex flex-col gap-3">
          <p className="text-xs font-bold tracking-[0.16em] text-muted uppercase">Lịch trình nhóm · Food Tour</p>
          <h1 className={`text-[clamp(44px,13vw,64px)] leading-none font-extrabold tracking-[-0.04em] text-balance ${trip.start_date ? 'pr-24' : ''}`}>
            {trip.city}
            <span className="text-cat-food">.</span>
          </h1>
          {trip.start_date && (
            <div className="absolute top-0 right-0 rotate-[8deg] border-[2.5px] border-ink bg-sticker px-3 py-2 text-center text-xl leading-none font-black text-on-cat tabular-nums shadow-[4px_4px_0_var(--color-ink)]">
              {stampDates(trip.start_date, trip.end_date)}
              {dayCount > 0 && <small className="mt-1 block text-[10px] font-bold tracking-[0.12em]">{dayCount} NGÀY</small>}
            </div>
          )}
          <p className="text-sm font-medium text-muted">
            <b className="text-ink">{trip.name}</b>
            {dateRange(trip) && ` · ${dateRange(trip)}`} · {stops.length} điểm dừng
          </p>
        </header>

        {stops.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Chưa có chỗ nào trong lịch trình.</p>
        ) : (
          <SharedSchedule token={token} stops={stops} />
        )}

        <p className="text-center text-xs text-muted">Chia sẻ từ Food Tour nhóm · link tự hết hạn</p>
      </main>
    </AppFrame>
  );
}
