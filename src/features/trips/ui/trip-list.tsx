'use client';

import { Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { CATEGORY_LABELS, placeKeyOf } from '@/features/places/constants';
import { formatDayMonth } from '@/shared/date';
import { Badge } from '@/shared/ui/badge';
import { Pagination } from '@/shared/ui/pagination';
import { Skeleton } from '@/shared/ui/skeleton';
import { staggerStyle } from '@/shared/ui/stagger';
import { STATUS_LABELS, STATUS_TONES, type TripTab } from '../constants';
import type { TripStop } from '../repositories/trips-repo';
import { formatSlot } from '../services/timeline';
import { PlaceLines } from './place-lines';
import { StatusSelect } from './status-select';
import { StopEditor } from './stop-editor';
import { stopsFilter } from './trip-view';
import { usePagedStops, type InitialStops } from './use-paged-stops';
import { useStopEditing, type StopEditing } from './use-stop-editing';
import { useRemoveFromTrip, useSetStatus } from './use-trip-mutations';

const SKELETON_ROWS = 4;

function PlaceRow({
  index,
  tripId,
  item,
  days,
  editing,
  onStatus,
  onRemove,
}: {
  index: number;
  tripId: string;
  item: TripStop;
  days: string[];
  editing: StopEditing;
  onStatus: (s: TripStop['status']) => void;
  onRemove: () => void;
}) {
  const scheduled = item.visit_date !== null && item.visit_time !== null;
  return (
    <li className="stagger flex flex-col gap-2 rounded border border-line bg-card p-3 shadow-card" style={staggerStyle(index)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/places/${encodeURIComponent(placeKeyOf({ placeId: item.place.id, googlePlaceId: item.place.google_place_id }))}?trip=${tripId}`}
            className="block font-semibold leading-snug"
          >
            {item.place.name}
          </Link>
          <PlaceLines address={item.place.address} note={item.note} />
        </div>
        <Badge tone={STATUS_TONES[item.status]} className="shrink-0">
          {STATUS_LABELS[item.status]}
        </Badge>
      </div>
      <div className="flex gap-2">
        <StatusSelect label={`Trạng thái của ${item.place.name}`} value={item.status} onChange={onStatus} />
        <button
          type="button"
          aria-label={scheduled ? `Đổi giờ ${item.place.name}` : `Xếp giờ ${item.place.name}`}
          aria-expanded={editing.editingId === item.id}
          onClick={() => (editing.editingId === item.id ? editing.close() : editing.open(item))}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded border border-line bg-card px-3 text-sm font-semibold tabular-nums text-accent pressable hover:bg-surface"
        >
          <Clock size={16} aria-hidden />
          {scheduled ? `${formatSlot(item.visit_time!, item.visit_end_time)} · ${formatDayMonth(item.visit_date!)}` : 'Giờ'}
        </button>
        <button
          type="button"
          aria-label={`Xóa ${item.place.name} khỏi chuyến`}
          onClick={onRemove}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded border border-line bg-card pressable text-bad hover:bg-surface"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      </div>
      {editing.editingId === item.id && (
        <StopEditor
          days={days}
          value={editing.draft}
          onChange={editing.change}
          onSave={editing.save}
          onClearSchedule={scheduled ? editing.clearSchedule : undefined}
          onCancel={editing.close}
        />
      )}
    </li>
  );
}

/** Gom các dòng liền nhau cùng loại (trang đã sắp theo loại ở database) để vẽ tiêu đề nhóm. */
function groupByCategory(items: TripStop[]) {
  const groups: { category: TripStop['category']; rows: TripStop[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.category === item.category) last.rows.push(item);
    else groups.push({ category: item.category, rows: [item] });
  }
  return groups;
}

/** Tab Danh sách: chỗ gom theo loại, 20 chỗ một trang. */
export function TripList({ tripId, tab, days, initial }: { tripId: string; tab: TripTab; days: string[]; initial?: InitialStops }) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedStops(tripId, stopsFilter('list', tab), initial);
  const editing = useStopEditing(tripId, paged.items, days);
  const setStatus = useSetStatus(tripId);
  const remove = useRemoveFromTrip(tripId);
  const error = setStatus.error ?? remove.error ?? editing.error;

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
        <p className="py-8 text-center text-sm text-bad">Không tải được danh sách, thử lại sau.</p>
      ) : paged.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Chưa có chỗ nào ở đây. Đã biết quán thì bấm &quot;Thêm&quot;, chưa biết thì bấm nút tìm.</p>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-(--dur-base) ${paged.isSwitching ? 'opacity-60' : ''}`}>
          {groupByCategory(paged.items).map(({ category, rows }) => (
            <section key={category} className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{CATEGORY_LABELS[category]}</h2>
              <ul className="flex flex-col gap-2">
                {rows.map((item, index) => (
                  <PlaceRow
                    index={index}
                    key={item.id}
                    tripId={tripId}
                    item={item}
                    days={days}
                    editing={editing}
                    onStatus={(status) => setStatus.mutate({ tripPlaceId: item.id, status })}
                    onRemove={() => remove.mutate({ tripPlaceId: item.id })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Pagination page={paged.page} count={paged.count} onChange={goTo} label="Trang danh sách" />
    </div>
  );
}
