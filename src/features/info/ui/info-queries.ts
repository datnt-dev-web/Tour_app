'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { uploadWithTicket } from '@/shared/upload/direct-upload';
import { addInfoFileAction, addLinkAction, addNoteAction, prepareInfoUploadAction, removeInfoAction } from '../actions/info-actions';
import type { TripInfo } from '../repositories/infos-repo';

/** Danh sách lấy qua API route (cùng chỗ kiểm quyền với link mở tệp). */
export const tripInfosQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripInfos(tripId),
    queryFn: async (): Promise<TripInfo[]> => {
      const res = await fetch(`/api/trips/${tripId}/infos`);
      const body = (await res.json().catch(() => null)) as { items?: TripInfo[]; error?: { message?: string } } | null;
      if (res.ok && body?.items) return body.items;
      throw new Error(body?.error?.message ?? 'Không tải được thông tin, thử lại sau.');
    },
  });

export type NewInfo =
  | { kind: 'note'; title: string; body: string }
  | { kind: 'link'; title: string; url: string; note: string }
  | { kind: 'file'; title: string; file: File };

export function useAddInfo(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NewInfo) => {
      if (v.kind === 'note') return unwrap(await addNoteAction({ tripId, title: v.title, body: v.body }));
      if (v.kind === 'link') return unwrap(await addLinkAction({ tripId, title: v.title, url: v.url, note: v.note }));
      // Tải thẳng lên Cloudinary rồi server kiểm và ghi (tệp lớn hơn 4,5 MB không đi qua server được).
      const ticket = unwrap(await prepareInfoUploadAction({ tripId, fileName: v.file.name, size: v.file.size }));
      const publicId = await uploadWithTicket(ticket, v.file);
      return unwrap(await addInfoFileAction({ tripId, title: v.title, fileName: v.file.name, publicId }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tripInfos(tripId) }),
  });
}

export function useRemoveInfo(tripId: string) {
  const qc = useQueryClient();
  const key = queryKeys.tripInfos(tripId);
  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeInfoAction({ id })),
    // Ẩn ngay cho nhanh; lỗi thì trả lại danh sách cũ.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TripInfo[]>(key);
      qc.setQueryData<TripInfo[]>(key, (items) => items?.filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
