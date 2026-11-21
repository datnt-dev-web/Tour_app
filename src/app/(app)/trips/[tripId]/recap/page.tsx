import { ArrowLeft, Camera, MapPin, Star, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPhotoDeps } from '@/features/places/server/photo-deps';
import { THUMB_WIDTH } from '@/features/places/services/photo-service';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { buildRecap } from '@/features/trips/services/recap';
import { dateRange, tripDays } from '@/features/trips/services/timeline';
import { toTripStats } from '@/features/trips/services/trip-stats';
import { formatDayMonth } from '@/shared/date';
import { formatVnd } from '@/shared/money';
import { createServerSupabase } from '@/shared/supabase/server';

/** Số ảnh tối đa trên trang tổng kết (lưới 3 cột). */
const RECAP_PHOTOS = 9;

/** Trang tổng kết chuyến: thiết kế vừa một màn điện thoại để chụp màn hình đăng mạng xã hội. */
export default async function TripRecapPage({ params }: PageProps<'/trips/[tripId]/recap'>) {
  const { tripId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) notFound();
  const db = await createServerSupabase();
  const repo = createTripsRepo(db);
  const [detail, rawStats] = await Promise.all([repo.getTripDetail(tripId), repo.getTripStats(tripId)]);
  if (!detail) notFound();
  const { trip, items } = detail;
  const placeIds = [...new Set(items.map((i) => i.place_id))];

  const [{ data: reviews }, { data: photoRows }] = await Promise.all([
    db.from('place_reviews_internal').select('place_id, verdict, rating').in('place_id', placeIds.length ? placeIds : ['00000000-0000-0000-0000-000000000000']),
    db.from('place_photos').select('id, place_id, file_public_id, file_format').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(RECAP_PHOTOS),
  ]);
  const recap = buildRecap(trip, items, (reviews ?? []).map((r) => ({ ...r, verdict: r.verdict as 'up' | 'down' })));
  const stats = rawStats ? toTripStats({ ...rawStats, people: trip.party_size }, tripDays(trip)) : null;
  const photoDeps = createPhotoDeps(db);
  const photos = photoDeps
    ? (photoRows ?? [])
        .filter((p) => p.file_public_id.startsWith(`food-tour/places/${p.place_id}/`))
        .map((p) => ({ id: p.id, url: photoDeps.storage.imageUrl({ publicId: p.file_public_id, format: p.file_format }, { width: THUMB_WIDTH }) }))
    : [];

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <Link href={`/trips/${tripId}?view=stats`} aria-label="Quay lại" className="-ml-2 inline-flex size-11 items-center justify-center rounded pressable hover:bg-surface">
        <ArrowLeft size={20} aria-hidden />
      </Link>

      <article className="flex flex-col gap-5 rounded bg-deep p-5 text-white">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Tổng kết chuyến</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">{trip.city}</h1>
          <p className="text-sm text-white/80">
            {trip.name}
            {dateRange(trip) && ` · ${dateRange(trip)}`}
          </p>
        </header>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm bg-white/8 p-3">
            <dd className="text-2xl font-extrabold">{recap.days}</dd>
            <dt className="text-xs text-white/70">ngày</dt>
          </div>
          <div className="rounded-sm bg-white/8 p-3">
            <dd className="text-2xl font-extrabold">{recap.visitedCount}</dd>
            <dt className="text-xs text-white/70">chỗ đã đi</dt>
          </div>
          <div className="rounded-sm bg-white/8 p-3">
            <dd className="text-2xl font-extrabold">{trip.party_size}</dd>
            <dt className="text-xs text-white/70">người</dt>
          </div>
        </dl>

        {stats && stats.total > 0 && (
          <p className="flex items-center gap-2 text-sm">
            <Wallet size={16} aria-hidden className="text-white/70" />
            Tổng <b className="tabular-nums">{formatVnd(stats.total)}</b> · <b className="tabular-nums">{formatVnd(stats.perPerson)}</b>/người
          </p>
        )}

        {recap.top.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">Quán đỉnh nhất</h2>
            <ol className="flex flex-col gap-1.5">
              {recap.top.map((t, i) => (
                <li key={t.placeId} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent text-sm font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                  {t.avgRating && (
                    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                      <Star size={14} aria-hidden className="fill-warn text-warn" />
                      {t.avgRating}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-1" aria-label="Ảnh trong chuyến">
            {photos.map((p) => (
              <li key={p.id} className="aspect-square overflow-hidden rounded-sm bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary đã thu nhỏ sẵn */}
                <img src={p.url} alt="" className="size-full object-cover" />
              </li>
            ))}
          </ul>
        )}

        {recap.route.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">Lộ trình</h2>
            {recap.route.map((d) => (
              <p key={d.date} className="flex gap-2 text-sm">
                <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-white/60" />
                <span>
                  <b>{formatDayMonth(d.date)}:</b> {d.names.join(' → ')}
                </span>
              </p>
            ))}
          </section>
        )}

        <p className="text-center text-xs text-white/50">Food Tour nhóm</p>
      </article>

      {recap.visitedCount === 0 && <p className="text-center text-sm text-muted">Chưa có chỗ nào được đánh dấu “Đã đi”. Bấm “Đã tới” ở tab Hôm nay hoặc Timeline.</p>}
      <p className="flex items-center justify-center gap-2 text-center text-sm text-muted">
        <Camera size={16} aria-hidden />
        Chụp màn hình thẻ trên để đăng, hoặc gửi link chỉ xem bằng nút Chia sẻ của chuyến.
      </p>
    </main>
  );
}
