'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { addToTripAction, removeAction, setStatusAction } from '../actions/trip-actions';
import type { TripDetail, TripPlaceStatus } from '../repositories/trips-repo';

/** Sửa cache chuyến ngay, trả bản chụp cũ để onError hoàn tác. */
function useOptimisticTripEdit(tripId: string) {
  const qc = useQueryClient();
  const key = queryKeys.trip(tripId);
  return {
    async apply(edit: (d: TripDetail) => TripDetail) {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TripDetail>(key);
      if (previous) qc.setQueryData(key, edit(previous));
      return { previous };
    },
    rollback(ctx: { previous?: TripDetail } | undefined) {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    settle: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: queryKeys.tripsAll }),
        qc.invalidateQueries({ queryKey: queryKeys.tripLocations(tripId) }),
      ]),
  };
}

export function useSetStatus(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { tripPlaceId: string; status: TripPlaceStatus }) => unwrap(await setStatusAction(v)),
    onMutate: (v) =>
      o.apply((d) => ({ ...d, items: d.items.map((i) => (i.id === v.tripPlaceId ? { ...i, status: v.status } : i)) })),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: o.settle,
  });
}

export function useRemoveFromTrip(tripId: string) {
  const o = useOptimisticTripEdit(tripId);
  return useMutation({
    mutationFn: async (v: { tripPlaceId: string }) => unwrap(await removeAction(v)),
    onMutate: (v) => o.apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== v.tripPlaceId) })),
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
        qc.invalidateQueries({ queryKey: queryKeys.trip(v.input.tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripLocations(v.input.tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripsAll }),
        // Chỗ mới được lưu (hoặc đổi trạng thái) nên màn chỗ và sổ quán phải tải lại.
        qc.invalidateQueries({ queryKey: queryKeys.placeAll }),
        qc.invalidateQueries({ queryKey: queryKeys.bookAll }),
      ]),
  });
}
