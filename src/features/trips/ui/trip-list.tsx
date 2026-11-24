'use client';

import { Clock, Pencil } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { CATEGORY_LABELS } from '@/features/places/constants';
import { formatDayMonth } from '@/shared/date';
import { Badge } from '@/shared/ui/badge';
import { Pagination } from '@/shared/ui/pagination';
import { Skeleton } from '@/shared/ui/skeleton';
import { staggerStyle } from '@/shared/ui/stagger';
import { IconButton } from '@/shared/ui/icon-button';
import { buttonClass } from '@/shared/ui/button';
import { ConfirmDeleteButton } from '@/shared/ui/confirm-delete-button';
import { useQuery } from '@/shared/query/use-query';
import { STATUS_LABELS, STATUS_TONES, type TripTab } from '../constants';
import type { TripStop } from '../repositories/trips-repo';
import { formatSlot } from '../services/timeline';
import { PlaceLines } from './place-lines';
import { PlaceNameLink } from './place-name-link';
import { StatusSelect } from './status-select';
import { tripQuery } from './trip-queries';
import { StopEditor } from './stop-editor';
import { stopsFilter } from './trip-view';
import { usePagedStops, type InitialStops } from './use-paged-stops';
import { useStopEditing, type StopEditing } from './use-stop-editing';
import { useRemoveFromTrip, useSetStatus } from './use-trip-mutations';

// Chỉ tải khi bấm sửa (không nằm trong bundle đầu của tab Danh sách).
const EditPlaceSheet = dynamic(() => import('./edit-place-sheet').then((m) => m.EditPlaceSheet), { ssr: false });

const SKELETON_ROWS = 4;

function PlaceRow({
  index,
  tripId,
  item,
  days,
  editing,
  onStatus,
  onEdit,
  onRemove,
}: {
  index: number;
  tripId: string;
  item: TripStop;
  days: string[];
  editing: StopEditing;
  onStatus: (s: TripStop['status']) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const scheduled = item.visit_date !== null && item.visit_time !== null;
  return (
    <li className="stagger flex flex-col gap-2 rounded border border-line bg-card p-3 shadow-card" style={staggerStyle(index)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <PlaceNameLink place={item.place} tripId={tripId} />
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
          className={buttonClass('secondary', 'shrink-0 gap-1 px-3 tabular-nums text-accent')}
        >
          <Clock size={16} aria-hidden />
          {scheduled ? `${formatSlot(item.visit_time!, item.visit_end_time)} · ${formatDayMonth(item.visit_date!)}` : 'Giờ'}
        </button>
        <IconButton label={`Sửa ${item.place.name}`} tone="outline" className="text-accent" onClick={onEdit}>
          <Pencil size={18} aria-hidden />
        </IconButton>
        <ConfirmDeleteButton label={`Xóa ${item.place.name} khỏi chuyến`} tone="outline" className="text-bad" onConfirm={onRemove} />
      </div>
      {editing.editingId === item.id && (
        <StopEditor
          days={days}
          value={editing.draft}
          onChange={editing.change}
          onSave={editing.save}
          onClearSchedule={scheduled ? editing.clearSchedule : undefined}
          onCancel={editing.close}
          showCost={editing.canEditCost}
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
  const city = useQuery(tripQuery(tripId)).data?.trip.city ?? '';
  const [editingPlace, setEditingPlace] = useState<TripStop | null>(null);
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
                    onEdit={() => setEditingPlace(item)}
                    onRemove={() => remove.mutate({ tripPlaceId: item.id })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Pagination page={paged.page} count={paged.count} onChange={goTo} label="Trang danh sách" />
      {editingPlace && <EditPlaceSheet tripId={tripId} city={city} item={editingPlace} onClose={() => setEditingPlace(null)} />}
    </div>
  );
}
