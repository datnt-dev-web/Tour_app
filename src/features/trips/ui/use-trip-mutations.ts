'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import {
  addExpenseAction,
  addManualPlaceAction,
  addToTripAction,
  removeAction,
  removeExpenseAction,
  setExpensePayerAction,
  setPartySizeAction,
  updateStopAction,
  setStatusAction,
} from '../actions/trip-actions';
import type { StopsPage, TripInfo, TripPlacePatch, TripPlaceStatus, TripStop } from '../repositories/trips-repo';

type Snapshot = { stops: [readonly unknown[], StopsPage | undefined][]; info: TripInfo | undefined };

/**
 * Sửa lạc quan: mọi trang chỗ đã tải (Danh sách, Timeline, giá từng chỗ) và phần thông tin chuyến,
 * trả bản chụp để hoàn tác khi lỗi. Xong thì làm mới cả trang lẫn thống kê, vì sửa giờ/trạng thái
 * có thể đổi thứ tự, đổi trang, đổi tổng tiền.
 */
function useOptimisticTripEdit(tripId: string) {
  const qc = useQueryClient();
  const stopsKey = queryKeys.tripStopsAll(tripId);
  const infoKey = queryKeys.trip(tripId);
  return {
    async apply(edit: { stop?: (s: TripStop) => TripStop | null; info?: (i: TripInfo) => TripInfo }): Promise<Snapshot> {
      await Promise.all([qc.cancelQueries({ queryKey: stopsKey }), qc.cancelQueries({ queryKey: infoKey })]);
      const snapshot: Snapshot = { stops: qc.getQueriesData<StopsPage>({ queryKey: stopsKey }), info: qc.getQueryData<TripInfo>(infoKey) };
      const editStop = edit.stop;
      if (editStop) {
        qc.setQueriesData<StopsPage>({ queryKey: stopsKey }, (page) =>
          page ? { ...page, items: page.items.flatMap((s) => editStop(s) ?? []) } : page,
        );
      }
      if (edit.info && snapshot.info) qc.setQueryData(infoKey, edit.info(snapshot.info));
      return snapshot;
    },
    rollback(ctx: Snapshot | undefined) {
      if (!ctx) return;
      for (const [key, data] of ctx.stops) qc.setQueryData(key, data);
      if (ctx.info) qc.setQueryData(infoKey, ctx.info);
    },
    settle: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: infoKey }),
        qc.invalidateQueries({ queryKey: stopsKey }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStats(tripId) }),
        // Giá, người trả, khoản chi đổi thì số tiền chia cũng đổi.
        qc.invalidateQueries({ queryKey: queryKeys.tripSplit(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripsAll }),
        qc.invalidateQueries({ queryKey: queryKeys.tripLocations(tripId) }),
      ]),
  };
}

/** Chỉ đổi đúng chỗ có id này; trả null là bỏ chỗ khỏi trang. */
const onStop = (id: string, fn: (s: TripStop) => TripStop | null) => (s: TripStop) => (s.id === id ? fn(s) : s);

export function useSetStatus(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { tripPlaceId: string; status: TripPlaceStatus }) => unwrap(await setStatusAction(v)),
    onMutate: (v) => o.apply({ stop: onStop(v.tripPlaceId, (s) => ({ ...s, status: v.status })) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

/** Áp patch lên một chỗ trong cache, cùng dạng dữ liệu Postgres trả về (giờ có ":00"). */
function applyPatch(item: TripStop, patch: TripPlacePatch): TripStop {
  const seconds = (t: string | null) => (t ? `${t}:00` : null);
  return {
    ...item,
    ...(patch.schedule !== undefined && {
      visit_date: patch.schedule?.date ?? null,
      visit_time: seconds(patch.schedule?.time ?? null),
      visit_end_time: seconds(patch.schedule?.endTime ?? null),
    }),
    ...(patch.transport !== undefined && { transport: patch.transport?.trim() || null }),
    ...(patch.cost !== undefined && { cost: patch.cost }),
    ...(patch.paidBy !== undefined && { paid_by: patch.paidBy }),
  };
}

/** Sửa giờ / phương tiện / giá; timeline sắp lại và thống kê tính lại ngay nhờ sửa cache lạc quan. */
export function useUpdateStop(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { tripPlaceId: string; patch: TripPlacePatch }) => unwrap(await updateStopAction({ tripId, ...v })),
    onMutate: (v) => o.apply({ stop: onStop(v.tripPlaceId, (s) => applyPatch(s, v.patch)) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

/** Thêm chỗ thủ công; chỗ mới có thể vào sổ quán nên làm mới cả sổ quán. */
export function useAddManualPlace(tripId: string) {
  const qc = useQueryClient();
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: Omit<Parameters<typeof addManualPlaceAction>[0], 'tripId'>) => unwrap(await addManualPlaceAction({ tripId, ...v })),
    onSettled: () => Promise.all([o.settle(), qc.invalidateQueries({ queryKey: queryKeys.bookAll })]),
  });
}

export function useSetPartySize(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (partySize: number) => unwrap(await setPartySizeAction({ tripId, partySize })),
    onMutate: (partySize) => o.apply({ info: (i) => ({ ...i, trip: { ...i.trip, party_size: partySize } }) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

export function useAddExpense(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { label: string; amount: number; paidBy: string | null }) => unwrap(await addExpenseAction({ tripId, ...v })),
    onMutate: (v) =>
      o.apply({
        info: (i) => ({
          ...i,
          expenses: [
            ...i.expenses,
            {
              id: `optimistic-${Date.now()}`,
              trip_id: tripId,
              label: v.label.trim(),
              amount: v.amount,
              paid_by: v.paidBy,
              created_by: null,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

export function useRemoveExpense(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (expenseId: string) => unwrap(await removeExpenseAction({ expenseId })),
    onMutate: (expenseId) => o.apply({ info: (i) => ({ ...i, expenses: i.expenses.filter((e) => e.id !== expenseId) }) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

export function useSetExpensePayer(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { expenseId: string; paidBy: string | null }) => unwrap(await setExpensePayerAction(v)),
    onMutate: (v) => o.apply({ info: (i) => ({ ...i, expenses: i.expenses.map((e) => (e.id === v.expenseId ? { ...e, paid_by: v.paidBy } : e)) }) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

export function useRemoveFromTrip(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { tripPlaceId: string }) => unwrap(await removeAction(v)),
    onMutate: (v) => o.apply({ stop: onStop(v.tripPlaceId, () => null) }),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

/**
 * Thêm chỗ từ Khám phá. Giao diện "Đã thêm" do nơi gọi giữ qua onMutate/onError (chưa có dòng trip_places thật để sửa cache);
 * settle làm mới chuyến và danh sách chuyến.
 */
export const addedKey = (tripId: string, googlePlaceId: string) => `${tripId}:${googlePlaceId}`;

export function useAddToTrip(handlers: { onMutate: (key: string) => void; onError: (key: string, message: string) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { googlePlaceId: string; input: Parameters<typeof addToTripAction>[0] }) =>
      unwrap(await addToTripAction(v.input)),
    onMutate: (v) => handlers.onMutate(addedKey(v.input.tripId, v.googlePlaceId)),
    onError: (e, v) => handlers.onError(addedKey(v.input.tripId, v.googlePlaceId), e.message),
    onSettled: (_d, _e, v) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.tripStopsAll(v.input.tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStats(v.input.tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripLocations(v.input.tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripsAll }),
        // Chỗ mới được lưu (hoặc đổi trạng thái) nên màn chỗ và sổ quán phải tải lại.
        qc.invalidateQueries({ queryKey: queryKeys.placeAll }),
        qc.invalidateQueries({ queryKey: queryKeys.bookAll }),
      ]),
  });
}
