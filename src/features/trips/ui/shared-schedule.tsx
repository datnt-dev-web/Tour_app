'use client';

import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';
import { CATEGORY_LABELS } from '@/features/places/constants';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { formatDayMonth, nowHHMMInVietnam, todayInVietnam } from '@/shared/date';
import { DISTANCES_MAX_STOPS, NEAREST_LIMIT, NEARBY_MAX_M, ORIGIN_GRID_DEG } from '../constants';
import { formatDistance, snapToGrid } from '../services/geo';
import { formatDuration, freeMinutes, groupByDay, isScheduleLive, stayMinutes, stopPhase, type ShareStop, type StopPhase } from '../services/shared-schedule';
import type { StopDistances } from '../services/stop-distances';
import { useMyLocation, type MyLocation } from './use-my-location';
import { useSharedDistances } from './use-shared-distances';

/** Khối cao theo thời lượng: 1 phút = 1,6px (30 phút ≈ 48px, 75 phút = 120px); khoảng trống cũng theo tỉ lệ này. */
const PX_PER_MIN = 1.6;
const FREE_MIN_PX = 26;
const CLOCK_TICK_MS = 30_000;

// Tên lớp viết đủ để Tailwind giữ lại các màu này.
const CAT_FILL: Record<StoredPlaceCategory, string> = {
  food: 'bg-cat-food',
  snack: 'bg-cat-snack',
  cafe: 'bg-cat-cafe',
  play: 'bg-cat-play',
  stay: 'bg-cat-stay',
  gift: 'bg-cat-gift',
};
const EDGE = 'border-[2.5px] border-ink';
const HARD_SHADOW = 'shadow-[5px_5px_0_var(--color-ink)]';
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

const subscribeClock = (onChange: () => void) => {
  const t = setInterval(onChange, CLOCK_TICK_MS);
  return () => clearInterval(t);
};
const clockSnapshot = () => `${todayInVietnam()} ${nowHHMMInVietnam()}`;

/** "YYYY-MM-DD HH:MM" giờ VN, đổi mỗi phút. Lúc render ở server / hydrate là null: chưa đánh dấu đã qua / đang diễn ra để HTML hai bên khớp nhau. */
function useVietnamClock(): { today: string; now: string } | null {
  const snap = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
  if (!snap) return null;
  const [today, now] = snap.split(' ');
  return { today, now };
}

const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/**
 * Trang lịch trình chia sẻ (người xem không đăng nhập): mỗi chỗ là một khối màu theo loại, cao theo thời lượng,
 * khoảng trống giữa hai khối là thời gian di chuyển. "Gần tôi" tính quãng đường xe máy từ vị trí người xem
 * tới các chỗ chưa qua giờ; chỗ đã đi / đã qua giờ không được gợi ý.
 */
export function SharedSchedule({ token, stops }: { token: string; stops: ShareStop[] }) {
  const clock = useVietnamClock();
  const { location, start, stop } = useMyLocation({ autoStart: true });

  const phases = useMemo(() => {
    const live = clock !== null && isScheduleLive(stops, clock.today);
    return new Map(stops.map((s) => [s.id, live ? stopPhase(s, clock.today, clock.now) : ('upcoming' as StopPhase)]));
  }, [stops, clock]);
  const pendingIds = useMemo(
    () => stops.filter((s) => phases.get(s.id) !== 'done').slice(0, DISTANCES_MAX_STOPS).map((s) => s.id).sort(),
    [stops, phases],
  );
  const origin = location.status === 'ok' ? snapToGrid(location.coords, ORIGIN_GRID_DEG) : null;
  const distances = useSharedDistances(token, pendingIds, origin);

  const days = groupByDay(stops);
  return (
    <div className="flex flex-col gap-7">
      <NearMe location={location} onStart={start} onStop={stop} distances={distances} stops={stops} phases={phases} />

      {days.length > 1 && (
        <nav aria-label="Chọn ngày" className="sticky top-[env(safe-area-inset-top,0px)] z-10 -my-2 flex gap-2.5 overflow-x-auto bg-surface py-2.5 [scrollbar-width:none]">
          {days.map((d, i) => (
            <a key={d.date ?? 'none'} href={`#day-${i}`} className={`shrink-0 bg-card px-3.5 py-1.5 text-[13px] font-extrabold tabular-nums ${EDGE}`}>
              {d.date ? `Ngày ${i + 1} · ${formatDayMonth(d.date)}` : 'Chưa xếp giờ'}
            </a>
          ))}
        </nav>
      )}

      {days.map((d, i) => (
        <section key={d.date ?? 'none'} id={`day-${i}`} className="flex scroll-mt-16 flex-col">
          <h2 className="mb-4 -ml-1 -rotate-2 self-start bg-ink px-3.5 py-1.5 text-[15px] font-black tracking-wide text-surface uppercase">
            {d.date ? (
              <>
                Ngày {i + 1} · {weekday(d.date)} <em className="ml-1 bg-sticker px-1.5 font-extrabold text-on-cat not-italic">{formatDayMonth(d.date)}</em>
              </>
            ) : (
              'Chưa xếp giờ'
            )}
          </h2>
          {d.stops.map((s, j) => {
            const next = d.stops[j + 1];
            const free = next ? freeMinutes(s, next) : 0;
            return (
              <div key={s.id}>
                <StopBlock stop={s} phase={phases.get(s.id)!} meters={distances.data?.fromMe[s.id] ?? null} mode={distances.data?.mode ?? 'road'} />
                {free > 0 && (
                  <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3" style={{ minHeight: Math.max(FREE_MIN_PX, Math.round(free * PX_PER_MIN)) }}>
                    <div className="border-r-2 border-dashed border-ink" />
                    <p className="self-center text-xs font-semibold text-muted">↓ {formatDuration(free)} di chuyển / nghỉ</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function StopBlock({ stop: s, phase, meters, mode }: { stop: ShareStop; phase: StopPhase; meters: number | null; mode: StopDistances['mode'] }) {
  const minutes = stayMinutes(s);
  const showKm = phase !== 'done' && meters !== null;
  const tone = phase === 'done' ? 'opacity-45 grayscale shadow-none' : phase === 'now' ? `-rotate-1 shadow-[7px_7px_0_var(--color-sticker)]` : HARD_SHADOW;
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3">
      <div className="relative border-r-2 border-ink tabular-nums">
        {s.start && <b className="absolute top-0 right-2 text-[13px] leading-none font-extrabold">{s.start}</b>}
        <i className="absolute top-1.5 -right-1.5 h-0.5 w-2.5 bg-ink" />
      </div>
      <article className={`relative mb-2.5 flex flex-col gap-1 px-3 pt-2.5 pb-3 text-on-cat ${CAT_FILL[s.category]} ${EDGE} ${tone}`} style={{ minHeight: Math.round(minutes * PX_PER_MIN) }}>
        {phase === 'now' && (
          <span className="absolute -top-3 right-2.5 border-2 border-ink bg-sticker px-2 py-0.5 text-[11px] font-black tracking-wider text-on-cat uppercase">Đang ở đây</span>
        )}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold tracking-widest uppercase">{CATEGORY_LABELS[s.category]}</span>
          {s.start && (
            <span className="text-xs font-bold whitespace-nowrap tabular-nums">
              {s.start}
              {s.end ? `–${s.end}` : ''}
              {minutes > 0 && s.end ? ` · ${formatDuration(minutes)}` : ''}
            </span>
          )}
        </div>
        <h3 className="text-[19px] leading-tight font-black tracking-tight text-balance">{s.name}</h3>
        <p className={`flex items-start gap-1.5 text-[13px] font-medium ${s.address ? '' : 'italic opacity-75'}`}>
          <MapPin size={13} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
          {s.address || 'Chưa có địa chỉ'}
        </p>
        {(showKm || s.directions) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {showKm && (
              <span className={`px-2 py-1 text-xs font-extrabold tabular-nums ${meters < NEARBY_MAX_M ? 'border-2 border-ink bg-sticker text-on-cat' : 'bg-ink text-surface'}`}>
                cách {formatDistance(meters)}
                {mode === 'straight' ? ' (đường thẳng)' : ''}
              </span>
            )}
            {s.directions && (
              <a href={s.directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border-2 border-ink bg-card px-2.5 py-1 text-xs font-extrabold text-ink">
                <Navigation size={13} strokeWidth={2.5} aria-hidden />
                Chỉ đường
              </a>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

function NearMe({
  location,
  onStart,
  onStop,
  distances,
  stops,
  phases,
}: {
  location: MyLocation;
  onStart: () => void;
  onStop: () => void;
  distances: ReturnType<typeof useSharedDistances>;
  stops: ShareStop[];
  phases: Map<string, StopPhase>;
}) {
  if (location.status === 'idle') {
    return (
      <div>
        <button
          type="button"
          onClick={onStart}
          className={`flex w-full items-center justify-center gap-2.5 bg-ink px-4 py-3.5 text-base font-extrabold text-surface shadow-[5px_5px_0_var(--color-sticker)] transition-transform active:translate-x-[3px] active:translate-y-[3px] ${EDGE}`}
        >
          <LocateFixed size={18} aria-hidden />
          Xem chỗ nào gần tôi
        </button>
        <p className="mt-2 text-xs text-muted">Trình duyệt sẽ hỏi quyền vị trí. Vị trí chỉ dùng để tính quãng đường, không lưu lại.</p>
      </div>
    );
  }
  if (location.status === 'locating') return <p className="text-sm font-semibold text-muted">Đang lấy vị trí của bạn…</p>;
  if (location.status === 'denied' || location.status === 'unavailable') {
    return (
      <p className="text-sm text-muted">
        {location.status === 'denied' ? 'Chưa cho phép vị trí nên chưa biết chỗ nào gần.' : 'Máy không lấy được vị trí lúc này.'} Nếu đang mở trong Zalo hoặc Messenger, hãy mở
        link bằng Chrome hoặc Safari rồi thử lại.
      </p>
    );
  }

  const nearest = distances.data
    ? stops
        .filter((s) => phases.get(s.id) !== 'done' && distances.data!.fromMe[s.id] !== undefined)
        .sort((a, b) => distances.data!.fromMe[a.id] - distances.data!.fromMe[b.id])
        .slice(0, NEAREST_LIMIT)
    : [];
  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-black tracking-tight">Gần bạn nhất</h2>
        <button type="button" onClick={onStop} className="p-1 text-[13px] font-semibold text-muted underline">
          Tắt vị trí
        </button>
      </div>
      {distances.loading && <p className="text-sm text-muted">Đang tính quãng đường…</p>}
      {distances.error && <p className="text-sm text-bad">{distances.error}</p>}
      {distances.data && nearest.length === 0 && <p className="text-sm text-muted">Chưa tính được quãng đường tới chỗ nào: có thể bạn đang ở quá xa, hoặc các chỗ còn lại chưa có địa chỉ.</p>}
      {nearest.length > 0 && (
        <ol className="grid grid-cols-1 gap-2.5 min-[401px]:grid-cols-3">
          {nearest.map((s, i) => {
            const label = formatDistance(distances.data!.fromMe[s.id]);
            const [num, unit] = label.split(' ');
            const body = (
              <>
                <span className="text-[11px] font-extrabold tracking-wider uppercase">
                  #{i + 1} · {phases.get(s.id) === 'now' ? 'đang diễn ra' : (s.start ?? 'chưa xếp giờ')}
                </span>
                <span className="text-[26px] leading-none font-black tracking-tight tabular-nums">
                  {num}
                  <span className="text-[13px] font-extrabold"> {unit}</span>
                </span>
                <span className="text-[13px] leading-tight font-bold">{s.name}</span>
              </>
            );
            const cls = `flex flex-col gap-1.5 p-2.5 text-on-cat ${CAT_FILL[s.category]} ${EDGE} shadow-[4px_4px_0_var(--color-ink)]`;
            return (
              <li key={s.id} className="flex">
                {s.directions ? (
                  <a href={s.directions} target="_blank" rel="noopener noreferrer" className={`w-full ${cls}`}>
                    {body}
                  </a>
                ) : (
                  <div className={`w-full ${cls}`}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {distances.data?.mode === 'straight' && <p className="text-xs text-muted">Máy chủ tính đường đang bận nên tạm hiện khoảng cách đường thẳng.</p>}
    </section>
  );
}
