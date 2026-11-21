'use client';

import { AlertTriangle, Check, Clock, MapPin, Navigation } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type CSSProperties } from 'react';
import { placeKeyOf } from '@/features/places/constants';
import { formatDayMonth } from '@/shared/date';
import { WeatherChip } from './weather-chip';
import { DayReorder } from './day-reorder';
import { formatVnd, perPerson } from '@/shared/money';
import { Badge } from '@/shared/ui/badge';
import { Pagination } from '@/shared/ui/pagination';
import { Skeleton } from '@/shared/ui/skeleton';
import { staggerStyle } from '@/shared/ui/stagger';
import { STATUS_LABELS, STATUS_TONES, type TripTab } from '../constants';
import type { TripStop } from '../repositories/trips-repo';
import { buildTimeline, toHHMM } from '../services/timeline';
import { PlaceLines } from './place-lines';
import { StopEditor } from './stop-editor';
import { addressDirectionsUrl, stopsFilter } from './trip-view';
import { usePagedStops, type InitialStops } from './use-paged-stops';
import { useStopEditing, type StopEditing } from './use-stop-editing';
import { useSetStatus } from './use-trip-mutations';

const SKELETON_ROWS = 4;

/** Khoảng cách từ đỉnh mỗi dòng tới tâm chấm, khớp với dòng giờ bên trái. */
const DOT_TOP = '1.35rem';

/** Màu trên đường timeline tại vị trí t (0 = chỗ đầu ngày, 1 = chỗ cuối): đậm dần sang nhạt trong cùng tông xanh. */
const railColor = (t: number) =>
  `color-mix(in oklab, var(--color-accent) ${Math.round((1 - Math.min(Math.max(t, 0), 1)) * 100)}%, var(--color-accent-soft))`;

/** Đoạn đường của dòng `index`: nối từ giữa chỗ trước tới giữa chỗ sau, để các đoạn ghép lại thành một dải liền. */
function railStyle(index: number, count: number): CSSProperties {
  const step = count > 1 ? 1 / (count - 1) : 0;
  const t = index * step;
  return {
    top: index === 0 ? DOT_TOP : 0,
    bottom: index === count - 1 ? `calc(100% - ${DOT_TOP})` : 0,
    backgroundImage: `linear-gradient(to bottom, ${railColor(t - step / 2)}, ${railColor(t + step / 2)})`,
  };
}

function StopCard({
  tripId,
  item,
  days,
  people,
  editing,
  onToggleVisited,
}: {
  tripId: string;
  item: TripStop;
  days: string[];
  people: number;
  editing: StopEditing;
  onToggleVisited: (item: TripStop) => void;
}) {
  const scheduled = item.visit_time !== null;
  const visited = item.status === 'visited';
  const directions = addressDirectionsUrl(item.place);
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-2 rounded border p-3 transition-colors duration-(--dur-base) ${
        visited ? 'border-line bg-surface' : 'border-line bg-card shadow-card'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={visited}
          aria-label={visited ? `Bỏ đánh dấu đã đi ${item.place.name}` : `Đánh dấu đã đi ${item.place.name}`}
          onClick={() => onToggleVisited(item)}
          className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full pressable"
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-(--dur-base) ${
              visited ? 'border-muted bg-muted text-white' : 'border-accent/40 text-transparent hover:border-accent hover:text-accent/40'
            }`}
          >
            <Check size={14} strokeWidth={3} aria-hidden />
          </span>
        </button>
        <div className={`min-w-0 flex-1 ${visited ? 'opacity-60' : ''}`}>
          <Link
            href={`/places/${encodeURIComponent(placeKeyOf({ placeId: item.place.id, googlePlaceId: item.place.google_place_id }))}?trip=${tripId}`}
            className={`block font-semibold leading-snug ${visited ? 'text-muted line-through' : ''}`}
          >
            {item.place.name}
          </Link>
          <PlaceLines address={item.place.address} note={item.note} />
          {item.transport && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <Navigation size={12} aria-hidden />
              {item.transport}
            </p>
          )}
          {item.cost !== null && (
            <p className="text-sm font-semibold tabular-nums text-ink">
              {formatVnd(item.cost)}đ <span className="font-normal text-muted">· {formatVnd(perPerson(item.cost, people))}đ/người</span>
            </p>
          )}
        </div>
        <Badge tone={STATUS_TONES[item.status]} className="shrink-0">
          {STATUS_LABELS[item.status]}
        </Badge>
      </div>
      {editing.editingId === item.id ? (
        <StopEditor
          days={days}
          value={editing.draft}
          onChange={editing.change}
          onSave={editing.save}
          onClearSchedule={scheduled ? editing.clearSchedule : undefined}
          onCancel={editing.close}
        />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => editing.open(item)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-sm px-2 text-sm font-semibold pressable hover:bg-card ${visited ? 'text-muted' : 'text-accent'}`}
          >
            <Clock size={16} aria-hidden />
            {scheduled ? 'Sửa giờ, giá' : 'Xếp giờ'}
          </button>
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chỉ đường tới ${item.place.name} trên Google Maps`}
              title="Chỉ đường"
              className={`-mr-1 inline-flex size-11 items-center justify-center rounded-full pressable hover:bg-surface ${visited ? 'text-muted' : 'text-accent'}`}
            >
              <MapPin size={18} aria-hidden />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lịch trình theo ngày, mỗi ngày xếp theo giờ; chỗ chưa có giờ gom cuối để nhóm xếp tiếp.
 * Lọc ngày và chia trang ở database (20 chỗ một trang); cờ trùng giờ cũng tính ở đó nên đúng cả qua các trang.
 * Tích tròn ở mỗi chỗ chuyển nhanh sang "Đã đi" (bỏ tích thì về "Đã chốt").
 */
export function TripTimeline({
  tripId,
  tab,
  day,
  days,
  people,
  initial,
}: {
  tripId: string;
  tab: TripTab;
  /** 'all', 'none' (chưa xếp giờ) hoặc YYYY-MM-DD; chọn ở hàng lọc của màn chuyến. */
  day: string;
  days: string[];
  people: number;
  initial?: InitialStops;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedStops(tripId, stopsFilter('timeline', tab, day), initial);
  const items = paged.items;
  const editing = useStopEditing(tripId, items, days);
  const setStatus = useSetStatus(tripId);
  const onToggleVisited = (item: TripStop) =>
    setStatus.mutate({ tripPlaceId: item.id, status: item.status === 'visited' ? 'confirmed' : 'visited' });
  const error = setStatus.error ?? editing.error;
  const { days: timelineDays, unscheduled } = buildTimeline(items, days);
  // Ngày đang ở chế độ kéo thả sắp xếp (mỗi lúc một ngày).
  const [reordering, setReordering] = useState<string | null>(null);

  function goTo(page: number) {
    paged.setPage(page);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div ref={top} className="flex scroll-mt-4 flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error.message}
        </p>
      )}
      {paged.isPending ? (
        Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-28" />)
      ) : paged.isError ? (
        <p className="py-8 text-center text-sm text-bad">Không tải được lịch trình, thử lại sau.</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {day === 'all' ? 'Chưa có chỗ nào. Bấm "Thêm" để thêm quán kèm giờ.' : 'Không có chỗ nào trong mục này.'}
        </p>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-(--dur-base) ${paged.isSwitching ? 'opacity-60' : ''}`}>
          {day === 'all' && timelineDays.length === 0 && (
            <p className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">
              Chưa chỗ nào có giờ. Bấm &quot;Xếp giờ&quot; ở từng chỗ bên dưới, timeline sẽ tự sắp theo giờ.
            </p>
          )}
          {timelineDays.map((d) => (
            <section key={d.date} className="flex flex-col gap-2">
              <h2 className="flex items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide text-muted">
                <span>
                  {d.dayNumber ? `Ngày ${d.dayNumber} · ` : ''}
                  {formatDayMonth(d.date)}
                </span>
                <span className="flex items-center gap-2">
                  <WeatherChip tripId={tripId} date={d.date} className="text-ink" />
                  {d.stops.length > 1 && reordering !== d.date && (
                    <button type="button" onClick={() => setReordering(d.date)} className="min-h-11 px-1 text-xs font-semibold normal-case tracking-normal text-accent">
                      Sắp xếp
                    </button>
                  )}
                </span>
              </h2>
              {reordering === d.date ? (
                <DayReorder tripId={tripId} stops={d.stops.map((x) => x.item)} onDone={() => setReordering(null)} />
              ) : (
              <ol className="flex flex-col">
                {d.stops.map(({ item, clash }, index) => {
                  const visited = item.status === 'visited';
                  const t = d.stops.length > 1 ? index / (d.stops.length - 1) : 0;
                  return (
                    <li key={item.id} style={staggerStyle(index)} className="stagger flex gap-2">
                      <span className={`flex w-12 shrink-0 flex-col items-end pt-3 tabular-nums ${clash ? 'text-warn' : visited ? 'text-muted' : 'text-ink'}`}>
                        <span className="text-sm font-bold">{toHHMM(item.visit_time)}</span>
                        {item.visit_end_time && <span className="text-xs text-muted">{toHHMM(item.visit_end_time)}</span>}
                      </span>
                      <div aria-hidden className="relative w-4 shrink-0">
                        {d.stops.length > 1 && <span className="absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full" style={railStyle(index, d.stops.length)} />}
                        <span
                          className="absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-surface"
                          style={{ top: DOT_TOP, backgroundColor: visited ? 'var(--color-line)' : railColor(t) }}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-3">
                        {clash && (
                          <Badge tone="warn" className="self-start">
                            <AlertTriangle size={12} aria-hidden />
                            Trùng giờ
                          </Badge>
                        )}
                        <StopCard tripId={tripId} item={item} days={days} people={people} editing={editing} onToggleVisited={onToggleVisited} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              )}
            </section>
          ))}
          {unscheduled.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Chưa xếp giờ</h2>
              <ul className="flex flex-col gap-2">
                {unscheduled.map((item) => (
                  <li key={item.id} className="flex">
                    <StopCard tripId={tripId} item={item} days={days} people={people} editing={editing} onToggleVisited={onToggleVisited} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <Pagination page={paged.page} count={paged.count} onChange={goTo} label="Trang lịch trình" />
    </div>
  );
}
