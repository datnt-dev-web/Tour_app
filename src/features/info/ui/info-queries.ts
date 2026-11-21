'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { addLinkAction, addNoteAction, removeInfoAction, uploadInfoFileAction } from '../actions/info-actions';
import type { InfoItem } from '../services/info-service';

/** Danh sách lấy qua API route vì link tệp phải ký ở server. */
export const tripInfosQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripInfos(tripId),
    queryFn: async (): Promise<InfoItem[]> => {
      const res = await fetch(`/api/trips/${tripId}/infos`);
      const body = (await res.json().catch(() => null)) as { items?: InfoItem[]; error?: { message?: string } } | null;
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
      const form = new FormData();
      form.set('tripId', tripId);
      form.set('title', v.title);
      form.set('file', v.file);
      return unwrap(await uploadInfoFileAction(form));
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
      const prev = qc.getQueryData<InfoItem[]>(key);
      qc.setQueryData<InfoItem[]>(key, (items) => items?.filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
