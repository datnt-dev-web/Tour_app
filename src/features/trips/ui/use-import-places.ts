'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { importTripPlacesAction, previewImportAction } from '../actions/import-actions';
import type { ImportRow } from '../import/import-rows';

/** Đọc file thành bản xem trước (chưa ghi gì). */
export function usePreviewImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set('file', file);
      return unwrap(await previewImportAction(form));
    },
  });
}

/** Ghi các dòng đã xem trước vào chuyến; làm mới mọi màn đọc chỗ của chuyến và sổ quán. */
export function useImportPlaces(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ImportRow[]) => unwrap(await importTripPlacesAction({ tripId, rows })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStopsAll(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStats(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripLocations(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripsAll }),
        qc.invalidateQueries({ queryKey: queryKeys.bookAll }),
      ]),
  });
}
