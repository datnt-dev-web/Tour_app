'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import type { TripStop } from '../repositories/trips-repo';
import { formatSlot, reflowDay } from '../services/timeline';
import { useUpdateStop } from './use-trip-mutations';

/** Giữ ngón tay chừng này ms mới bắt đầu kéo, để vuốt cuộn trang không bị hiểu nhầm là kéo. */
const TOUCH_DELAY_MS = 180;

/** Kéo thả sắp lại các chỗ trong một ngày; thả xong giờ tự dời (giữ thời lượng, chừa thời gian đi lại). */
export function DayReorder({ tripId, stops, onDone }: { tripId: string; stops: TripStop[]; onDone: () => void }) {
  const [order, setOrder] = useState(stops);
  const update = useUpdateStop(tripId);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setOrder((list) => arrayMove(list, list.findIndex((s) => s.id === e.active.id), list.findIndex((s) => s.id === e.over!.id)));
  }

  async function save() {
    setSaving(true);
    // Ghi lần lượt: mỗi chỗ một lần sửa giờ (cập nhật lạc quan, lỗi thì hoàn lại từng chỗ).
    for (const c of reflowDay(order)) await update.mutateAsync({ tripPlaceId: c.id, patch: { schedule: c.schedule } }).catch(() => {});
    setSaving(false);
    onDone();
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {order.map((s) => (
              <SortableRow key={s.id} stop={s} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {update.error && <p className="text-sm text-bad">{update.error.message}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onDone} disabled={saving} className="flex-1">
          Hủy
        </Button>
        <Button onClick={() => void save()} disabled={saving} className="flex-1">
          {saving ? 'Đang lưu…' : 'Lưu thứ tự'}
        </Button>
      </div>
    </div>
  );
}

function SortableRow({ stop }: { stop: TripStop }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded border border-line bg-card p-3 ${isDragging ? 'z-10 shadow-card' : ''}`}
    >
      <button
        type="button"
        aria-label={`Kéo để đổi thứ tự ${stop.place.name}`}
        className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} aria-hidden />
      </button>
      <div className="min-w-0">
        <p className="truncate font-semibold">{stop.place.name}</p>
        <p className="text-sm text-muted">{stop.visit_time ? formatSlot(stop.visit_time, stop.visit_end_time) : ''}</p>
      </div>
    </li>
  );
}
