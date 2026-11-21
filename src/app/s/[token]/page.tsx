import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORY_LABELS } from '@/features/places/constants';
import { loadSharedTrip } from '@/features/trips/services/share';
import { dateRange, formatSlot } from '@/features/trips/services/timeline';
import { addressDirectionsUrl } from '@/features/trips/ui/trip-view';
import { formatDayMonth } from '@/shared/date';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { AppFrame } from '@/shared/ui/app-frame';

// Link riêng tư: không cho máy tìm kiếm lập chỉ mục, luôn đọc mới (thu hồi là mất ngay).
export const metadata: Metadata = { title: 'Lịch trình chuyến đi', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Trang chỉ xem lịch trình cho người ngoài nhóm: không tiền, không ghi chú, không thông tin nội bộ. */
export default async function SharedTripPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  const admin = createAdminSupabase();
  const shared = await loadSharedTrip(
    {
      findByToken: async (t) => {
        const { data } = await admin.from('trips').select('id, name, city, start_date, end_date, share_expires_at').eq('share_token', t).maybeSingle();
        return data;
      },
      listStops: async (tripId) => {
        const { data } = await admin
          .from('trip_places')
          .select('id, visit_date, visit_time, visit_end_time, places(name, address, city, category, google_place_id)')
          .eq('trip_id', tripId)
          .neq('status', 'dropped')
          .order('visit_date', { nullsFirst: false })
          .order('visit_time', { nullsFirst: false });
        return (data ?? []).flatMap((r) => (r.places ? [{ ...r, place: r.places }] : []));
      },
    },
    token,
  );
  if (!shared) notFound();
  const { trip, stops } = shared;

  const days = new Map<string, typeof stops>();
  for (const s of stops) {
    const key = s.visit_date ?? 'none';
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  return (
    <AppFrame>
      <main className="flex flex-col gap-4 px-3 py-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lịch trình</p>
          <h1 className="text-2xl font-extrabold">{trip.city}</h1>
          <p className="text-sm text-muted">
            {trip.name}
            {dateRange(trip) && ` · ${dateRange(trip)}`}
          </p>
        </header>
        {stops.length === 0 && <p className="py-8 text-center text-sm text-muted">Chưa có chỗ nào trong lịch trình.</p>}
        {[...days].map(([day, list]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{day === 'none' ? 'Chưa xếp giờ' : formatDayMonth(day)}</h2>
            <ol className="flex flex-col gap-2">
              {list.map((s) => {
                const directions = addressDirectionsUrl(s.place);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded border border-line bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.place.name}</p>
                      <p className="truncate text-sm text-muted">
                        {s.visit_time ? formatSlot(s.visit_time, s.visit_end_time) : ''}
                        {s.visit_time ? ' · ' : ''}
                        {CATEGORY_LABELS[s.place.category]}
                        {s.place.address ? ` · ${s.place.address}` : ''}
                      </p>
                    </div>
                    {directions && (
                      <a href={directions} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-accent">
                        Chỉ đường
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <p className="pt-4 text-center text-xs text-muted">Chia sẻ từ Food Tour nhóm · link tự hết hạn</p>
      </main>
    </AppFrame>
  );
}
