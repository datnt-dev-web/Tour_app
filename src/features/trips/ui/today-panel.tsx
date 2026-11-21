'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, LocateFixed, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CATEGORY_LABELS } from '@/features/places/constants';
import { nowHHMMInVietnam, todayInVietnam } from '@/shared/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import type { TripStop } from '../repositories/trips-repo';
import { formatSlot } from '../services/timeline';
import { planToday } from '../services/today';
import { distanceMeters, formatDistance } from './geo';
import { tripLocationsQuery, tripStopsQuery } from './trip-queries';
import { addressDirectionsUrl, directionsUrl } from './trip-view';
import { useMyLocation } from './use-my-location';
import { useSetStatus } from './use-trip-mutations';
import { WeatherChip } from './weather-chip';

const CLOCK_TICK_MS = 30_000;
const SKELETON_ROWS = 3;

/** Giờ hiện tại (VN), cập nhật mỗi 30 giây để "còn X phút" tự chạy. */
function useNowHHMM() {
  const [now, setNow] = useState(() => nowHHMMInVietnam());
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMMInVietnam()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

function untilLabel(minutes: number | null): { text: string; late: boolean } | null {
  if (minutes === null) return null;
  if (minutes < 0) return { text: `Trễ ${formatMinutes(-minutes)}`, late: true };
  return { text: minutes === 0 ? 'Đến giờ rồi' : `Còn ${formatMinutes(minutes)}`, late: false };
}

const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}` : `${m} phút`);

/** Tab "Hôm nay": chỗ đang ở / kế tiếp với chỉ đường và nút "Đã tới", rồi các chỗ còn lại trong ngày. */
export function TodayPanel({ tripId }: { tripId: string }) {
  const today = todayInVietnam();
  const now = useNowHHMM();
  const { data, isPending, isError } = useQuery(tripStopsQuery(tripId, { order: 'schedule', statuses: ['wanted', 'confirmed', 'visited'], day: today, page: 1 }));
  const { data: locations } = useQuery(tripLocationsQuery(tripId));
  const { location, start } = useMyLocation();
  const setStatus = useSetStatus(tripId);

  if (isPending) return <div className="flex flex-col gap-3">{Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (isError) return <p className="py-8 text-center text-sm text-bad">Không tải được lịch hôm nay, thử lại sau.</p>;
  if (data.items.length === 0) return <p className="py-8 text-center text-sm text-muted">Hôm nay chưa xếp chỗ nào. Vào Timeline để xếp giờ.</p>;

  const plan = planToday(data.items, now);
  const pointOf = (s: TripStop) => locations?.points.find((p) => p.tripPlaceId === s.id);
  const distanceTo = (s: TripStop) => {
    const p = pointOf(s);
    return p && location.status === 'ok' ? formatDistance(distanceMeters(location.coords, p)) : null;
  };
  const directionsOf = (s: TripStop) => {
    const p = pointOf(s);
    return p ? directionsUrl(p) : addressDirectionsUrl(s.place);
  };
  const markVisited = (s: TripStop) => setStatus.mutate({ tripPlaceId: s.id, status: 'visited' });

  const focus = plan.current?.stop ?? plan.next?.stop ?? null;
  const until = plan.current ? null : untilLabel(plan.next?.minutesUntil ?? null);

  return (
    <section className="flex flex-col gap-4" aria-label="Lịch hôm nay">
      <WeatherChip tripId={tripId} date={today} className="self-end text-sm text-ink" />
      {focus ? (
        <article className="flex flex-col gap-3 rounded bg-deep p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{plan.current ? 'Đang ở' : 'Kế tiếp'}</p>
            {until && <Badge tone={until.late ? 'bad' : 'accent'}>{until.text}</Badge>}
          </div>
          <div>
            <h2 className="text-xl font-extrabold leading-tight">{focus.place.name}</h2>
            <p className="text-sm text-white/80">
              {focus.visit_time ? formatSlot(focus.visit_time, focus.visit_end_time) : 'Chưa xếp giờ'}
              {' · '}
              {CATEGORY_LABELS[focus.category]}
              {distanceTo(focus) && ` · cách ${distanceTo(focus)}`}
            </p>
            {focus.note && <p className="mt-1 text-sm text-white/80">{focus.note}</p>}
          </div>
          <div className="flex gap-2">
            {directionsOf(focus) && (
              <a href={directionsOf(focus)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-white/10 text-sm font-semibold pressable hover:bg-white/15">
                <Navigation size={18} aria-hidden />
                Chỉ đường
              </a>
            )}
            <Button onClick={() => markVisited(focus)} disabled={setStatus.isPending} className="flex-1">
              <Check size={18} aria-hidden />
              Đã tới
            </Button>
          </div>
          {location.status === 'idle' && (
            <button type="button" onClick={start} className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-white/80 underline-offset-2 hover:underline">
              <LocateFixed size={16} aria-hidden />
              Hiện khoảng cách từ chỗ tôi
            </button>
          )}
        </article>
      ) : (
        <p className="rounded bg-good-bg p-4 text-center text-sm font-semibold text-good">Xong hết lịch hôm nay rồi! 🎉</p>
      )}

      {setStatus.error && (
        <p role="alert" className="text-sm text-bad">
          {setStatus.error.message}
        </p>
      )}

      {plan.upcoming.length > 0 && (
        <TodayList title="Còn lại hôm nay" stops={plan.upcoming} distanceTo={distanceTo} />
      )}
      {plan.done.length > 0 && <TodayList title="Đã đi" stops={plan.done} distanceTo={() => null} muted />}
    </section>
  );
}

function TodayList({ title, stops, distanceTo, muted = false }: { title: string; stops: TripStop[]; distanceTo: (s: TripStop) => string | null; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="flex flex-col gap-2">
        {stops.map((s) => (
          <li key={s.id} className={`flex items-center justify-between gap-3 rounded border border-line bg-white p-3 ${muted ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <p className={`truncate font-semibold ${muted ? 'line-through' : ''}`}>{s.place.name}</p>
              <p className="truncate text-sm text-muted">
                {s.visit_time ? formatSlot(s.visit_time, s.visit_end_time) : 'Chưa xếp giờ'}
                {distanceTo(s) && ` · ${distanceTo(s)}`}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">{CATEGORY_LABELS[s.category]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
