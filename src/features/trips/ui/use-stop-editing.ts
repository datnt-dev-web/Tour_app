'use client';

import { useState } from 'react';
import { todayInVietnam } from '@/shared/date';
import { formatVnd, parseMoney } from '@/shared/money';
import type { TripPlace } from '../repositories/trips-repo';
import { defaultDay, lastTransport, suggestTime, toHHMM } from '../services/timeline';
import type { StopDraft } from './stop-editor';
import { useUpdateStop } from './use-trip-mutations';

type Stop = Pick<TripPlace, 'id' | 'visit_date' | 'visit_time' | 'visit_end_time' | 'transport' | 'cost'>;

/**
 * Trạng thái sửa một chỗ, dùng chung cho Danh sách và Timeline: mỗi lúc chỉ mở một dòng.
 * Chỗ chưa có giờ được gợi ý sẵn ngày (hôm nay nếu đang đi, không thì ngày đầu), giờ sau chỗ muộn nhất
 * của ngày đó, và phương tiện của chỗ gần nhất. Lưu một lần cả giờ, phương tiện, giá.
 */
export function useStopEditing(tripId: string, items: Stop[], days: string[]) {
  const mutation = useUpdateStop(tripId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StopDraft>({ date: '', time: '', endTime: '', transport: '', cost: '' });

  function open(item: Stop) {
    const common = { transport: item.transport ?? lastTransport(items) ?? '', cost: item.cost === null ? '' : formatVnd(item.cost) };
    if (item.visit_date && item.visit_time) {
      setDraft({ ...common, date: item.visit_date, time: toHHMM(item.visit_time), endTime: item.visit_end_time ? toHHMM(item.visit_end_time) : '' });
    } else {
      const date = defaultDay(days, todayInVietnam()) ?? todayInVietnam();
      setDraft({ ...common, date, time: suggestTime(items, date), endTime: '' });
    }
    setEditingId(item.id);
  }

  const close = () => setEditingId(null);

  /** Đổi ngày của chỗ chưa có giờ thì gợi ý lại giờ theo ngày mới. */
  function change(next: StopDraft) {
    const item = items.find((i) => i.id === editingId);
    const fresh = item && !item.visit_time && next.date !== draft.date;
    setDraft(fresh ? { ...next, time: suggestTime(items, next.date), endTime: '' } : next);
  }

  return {
    editingId,
    draft,
    error: mutation.error,
    open,
    close,
    change,
    save: () => {
      const cost = parseMoney(draft.cost);
      if (!editingId || cost === undefined) return;
      mutation.mutate({
        tripPlaceId: editingId,
        patch: {
          schedule: { date: draft.date, time: draft.time, endTime: draft.endTime || null },
          transport: draft.transport.trim() || null,
          cost,
        },
      });
      close();
    },
    clearSchedule: () => {
      if (!editingId) return;
      mutation.mutate({ tripPlaceId: editingId, patch: { schedule: null } });
      close();
    },
  };
}

export type StopEditing = ReturnType<typeof useStopEditing>;
