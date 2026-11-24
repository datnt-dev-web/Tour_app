'use client';

import { Check, Clock, LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nowHHMMInVietnam, todayInVietnam } from '@/shared/date';
import { useQuery } from '@/shared/query/use-query';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { iconButtonClass } from '@/shared/ui/icon-button';
import { Skeleton } from '@/shared/ui/skeleton';
import { NEAREST_LIMIT, ORIGIN_GRID_DEG } from '../constants';
import type { TripStop } from '../repositories/trips-repo';
import { formatDistance, snapToGrid } from '../services/geo';
import type { StopDistances } from '../services/stop-distances';
import { formatSlot } from '../services/timeline';
import { planToday } from '../services/today';
import { PlaceLines } from './place-lines';
import { PlaceNameLink } from './place-name-link';
import { ReminderActions, useInAppReminder } from './reminders';
import { stopDistancesQuery, tripLocationsQuery, tripStopsQuery } from './trip-queries';
import { addressDirectionsUrl, directionsUrl } from './trip-view';
import { useMyLocation, type MyLocation } from './use-my-location';
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
const slotOf = (s: TripStop) => (s.visit_time ? formatSlot(s.visit_time, s.visit_end_time) : 'Chưa xếp giờ');
/** Máy chủ định tuyến lỗi thì số km là đường thẳng: ghi rõ để không hiểu nhầm là quãng đường đi. */
const kmLabel = (meters: number, mode: StopDistances['mode']) => `cách ${formatDistance(meters)}${mode === 'straight' ? ' (đường thẳng)' : ''}`;

type NearbyName = { name: string; meters: number };

/** Một chỗ chưa đi: tên, giờ, địa chỉ, cách bao xa (theo vị trí hiện tại), các chỗ chưa đi khác ở gần. */
function TodayStopCard({
  stop,
  tripId,
  km,
  nearby,
  directions,
}: {
  stop: TripStop;
  tripId: string;
  km: string | null;
  nearby: NearbyName[];
  directions: string | null;
}) {
  return (
    <li className="flex items-start gap-2 rounded border border-line bg-card p-3 shadow-card">
      <div className="min-w-0 flex-1">
        <PlaceNameLink place={stop.place} tripId={tripId} />
        <p className="flex items-center gap-1 text-sm text-muted tabular-nums">
          <Clock size={13} aria-hidden className="shrink-0" />
          {slotOf(stop)}
        </p>
        <PlaceLines address={stop.place.address} />
        {km && (
          <p className="flex items-center gap-1 text-sm font-semibold text-accent">
            <Navigation size={13} aria-hidden className="shrink-0" />
            {km}
          </p>
        )}
        <NearbyLine nearby={nearby} className="text-muted" />
      </div>
      {directions && (
        <a href={directions} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường tới ${stop.place.name}`} title="Chỉ đường" className={iconButtonClass('accent', true)}>
          <MapPin size={18} aria-hidden />
        </a>
      )}
    </li>
  );
}

/** "Gần đó: A · 350 m, B · 800 m" — chỉ gồm chỗ chưa đi, để gom ghé một lượt. */
function NearbyLine({ nearby, className = '' }: { nearby: NearbyName[]; className?: string }) {
  if (nearby.length === 0) return null;
  return <p className={`mt-0.5 text-xs ${className}`}>Gần đó: {nearby.map((n) => `${n.name} · ${formatDistance(n.meters)}`).join(', ')}</p>;
}

/** Trạng thái vị trí: nút bật lần đầu, hoặc lời nhắc khi bị chặn. Đã có vị trí thì không hiện gì. */
function LocationHint({ location, onStart }: { location: MyLocation; onStart: () => void }) {
  if (location.status === 'ok') return null;
  if (location.status === 'locating') return <p className="text-sm text-muted">Đang lấy vị trí của bạn…</p>;
  if (location.status === 'denied') return <p className="text-sm text-muted">Chưa cho phép vị trí nên chưa biết cách bao xa. Bật lại trong cài đặt trình duyệt.</p>;
  if (location.status === 'unavailable') return <p className="text-sm text-muted">Máy không lấy được vị trí lúc này.</p>;
  return (
    <button type="button" onClick={onStart} className="inline-flex min-h-11 items-center gap-2 self-start rounded border border-line bg-card px-3 text-sm font-semibold text-accent pressable hover:bg-surface">
      <LocateFixed size={16} aria-hidden />
      Bật vị trí để xem cách bao xa
    </button>
  );
}

/**
 * Tab "Hôm nay": chỗ đang ở / kế tiếp, gợi ý chỗ chưa đi gần mình nhất và các chỗ chưa đi gần nhau,
 * số km là quãng đường đi thật (xe máy) từ vị trí hiện tại. Chỗ đã đi không bao giờ được gợi ý.
 */
export function TodayPanel({ tripId }: { tripId: string }) {
  const today = todayInVietnam();
  const now = useNowHHMM();
  const { data, isPending, isError } = useQuery(tripStopsQuery(tripId, { order: 'schedule', statuses: ['wanted', 'confirmed', 'visited'], day: today, page: 1 }));
  const { data: locations } = useQuery(tripLocationsQuery(tripId));
  const { location, start } = useMyLocation({ autoStart: true });
  const setStatus = useSetStatus(tripId);

  const items = data?.items ?? [];
  const pending = items.filter((s) => s.status !== 'visited');
  const origin = location.status === 'ok' ? snapToGrid(location.coords, ORIGIN_GRID_DEG) : null;
  const { data: dist } = useQuery(stopDistancesQuery(tripId, pending.map((s) => s.id).sort(), origin));

  const nextForReminder = (() => {
    if (!data) return null;
    const n = planToday(data.items, now).next;
    return n ? { id: n.stop.id, name: n.stop.place.name, minutesUntil: n.minutesUntil } : null;
  })();
  useInAppReminder(nextForReminder);

  if (isPending) return <div className="flex flex-col gap-3">{Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (isError) return <p className="py-8 text-center text-sm text-bad">Không tải được lịch hôm nay, thử lại sau.</p>;
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted">Hôm nay chưa xếp chỗ nào. Vào Timeline để xếp giờ.</p>;

  const plan = planToday(items, now);
  const byId = new Map(items.map((s) => [s.id, s]));
  const pointOf = (s: TripStop) => locations?.points.find((p) => p.tripPlaceId === s.id);
  const directionsOf = (s: TripStop) => {
    const p = pointOf(s);
    return p ? directionsUrl(p) : addressDirectionsUrl(s.place);
  };
  const kmOf = (s: TripStop) => {
    const m = dist?.fromMe[s.id];
    return dist && m !== undefined ? kmLabel(m, dist.mode) : null;
  };
  const nearbyOf = (s: TripStop): NearbyName[] =>
    (dist?.nearby[s.id] ?? []).flatMap((n) => {
      const other = byId.get(n.id);
      return other ? [{ name: other.place.name, meters: n.meters }] : [];
    });
  const nearest = dist
    ? pending
        .filter((s) => dist.fromMe[s.id] !== undefined)
        .sort((a, b) => dist.fromMe[a.id] - dist.fromMe[b.id])
        .slice(0, NEAREST_LIMIT)
    : [];
  const markVisited = (s: TripStop) => setStatus.mutate({ tripPlaceId: s.id, status: 'visited' });

  const focus = plan.current?.stop ?? plan.next?.stop ?? null;
  const until = plan.current ? null : untilLabel(plan.next?.minutesUntil ?? null);
  const focusKm = focus ? kmOf(focus) : null;

  return (
    <section className="flex flex-col gap-4" aria-label="Lịch hôm nay">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReminderActions tripId={tripId} />
        <WeatherChip tripId={tripId} date={today} className="text-sm text-ink" />
      </div>
      <LocationHint location={location} onStart={start} />

      {nearest.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Gần bạn nhất">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Gần bạn nhất</h3>
          <ul className="flex flex-col divide-y divide-line rounded border border-line bg-card px-3">
            {nearest.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <PlaceNameLink place={s.place} tripId={tripId} className="truncate" />
                  <p className="text-xs text-muted tabular-nums">{slotOf(s)}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-accent tabular-nums">{formatDistance(dist!.fromMe[s.id])}</span>
                {directionsOf(s) && (
                  <a href={directionsOf(s)!} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường tới ${s.place.name}`} title="Chỉ đường" className={iconButtonClass('accent', true)}>
                    <MapPin size={18} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {dist?.mode === 'straight' && <p className="text-xs text-muted">Chưa tính được quãng đường đi, tạm hiện khoảng cách đường thẳng.</p>}
        </section>
      )}

      {focus ? (
        <article className="flex flex-col gap-3 rounded bg-deep p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{plan.current ? 'Đang ở' : 'Kế tiếp'}</p>
            {until && <Badge tone={until.late ? 'bad' : 'accent'}>{until.text}</Badge>}
          </div>
          <div className="flex flex-col gap-0.5">
            <PlaceNameLink place={focus.place} tripId={tripId} className="text-xl font-extrabold" />
            <p className="flex items-center gap-1 text-sm text-white/80 tabular-nums">
              <Clock size={13} aria-hidden className="shrink-0" />
              {slotOf(focus)}
            </p>
            {focus.place.address && (
              <p className="flex items-center gap-1 text-sm text-white/80">
                <MapPin size={13} aria-hidden className="shrink-0" />
                <span className="truncate">{focus.place.address}</span>
              </p>
            )}
            {focusKm && (
              <p className="flex items-center gap-1 text-sm font-semibold text-highlight">
                <Navigation size={13} aria-hidden className="shrink-0" />
                {focusKm}
              </p>
            )}
            <NearbyLine nearby={nearbyOf(focus)} className="text-white/70" />
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
        <section className="flex flex-col gap-2" aria-label="Còn lại hôm nay">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Còn lại hôm nay</h3>
          <ul className="flex flex-col gap-2">
            {plan.upcoming.map((s) => (
              <TodayStopCard key={s.id} stop={s} tripId={tripId} km={kmOf(s)} nearby={nearbyOf(s)} directions={directionsOf(s)} />
            ))}
          </ul>
        </section>
      )}

      {plan.done.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Đã đi">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Đã đi</h3>
          <ul className="flex flex-col gap-2">
            {plan.done.map((s) => (
              <li key={s.id} className="rounded border border-line bg-surface p-3 opacity-70">
                <PlaceNameLink place={s.place} tripId={tripId} visited />
                <p className="text-sm text-muted tabular-nums">{slotOf(s)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
