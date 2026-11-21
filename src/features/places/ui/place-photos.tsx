'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { removePlacePhotoAction, uploadPlacePhotoAction } from '../actions/photo-actions';
import type { PlacePhotoView } from '../services/photo-service';

const photosQuery = (placeId: string) =>
  queryOptions({
    queryKey: queryKeys.placePhotos(placeId),
    queryFn: async (): Promise<{ photos: PlacePhotoView[]; enabled: boolean }> => {
      const res = await fetch(`/api/place-photos?placeId=${placeId}`);
      if (!res.ok) throw new Error('Không tải được ảnh, thử lại sau.');
      return res.json();
    },
  });

/** Ảnh đại diện từng quán cho Sổ quán (một lần cho cả nhóm). */
export const photoCoversQuery = queryOptions({
  queryKey: queryKeys.photoCovers,
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<Record<string, string>> => {
    const res = await fetch('/api/place-photos/covers');
    return res.ok ? ((await res.json()) as { covers: Record<string, string> }).covers : {};
  },
});

/** Lưới ảnh món/quán do nhóm chụp + nút chụp/tải ảnh (điện thoại mở thẳng camera). */
export function PlacePhotos({ placeId, tripId }: { placeId: string; tripId?: string }) {
  const inputId = useId();
  const qc = useQueryClient();
  const { data } = useQuery(photosQuery(placeId));
  const [viewing, setViewing] = useState<PlacePhotoView | null>(null);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.placePhotos(placeId) }), qc.invalidateQueries({ queryKey: queryKeys.photoCovers })]);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set('placeId', placeId);
      if (tripId) form.set('tripId', tripId);
      form.set('file', file);
      return unwrap(await uploadPlacePhotoAction(form));
    },
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await removePlacePhotoAction({ id })), onSuccess: refresh });

  if (data && !data.enabled) return null;
  const photos = data?.photos ?? [];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">Ảnh của nhóm</h2>
        <label htmlFor={inputId} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded border border-line bg-card px-3 text-sm font-semibold pressable hover:bg-surface ${upload.isPending ? 'pointer-events-none opacity-50' : ''}`}>
          <Camera size={18} aria-hidden />
          {upload.isPending ? 'Đang tải…' : 'Thêm ảnh'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = '';
            if (f) upload.mutate(f);
          }}
        />
      </div>
      {(upload.error ?? remove.error) && <p role="alert" className="text-sm text-bad">{(upload.error ?? remove.error)!.message}</p>}
      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-1">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setViewing(p)} className="block aspect-square w-full overflow-hidden rounded-sm bg-surface pressable" aria-label="Xem ảnh lớn">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary đã thu nhỏ sẵn, link ký riêng */}
                <img src={p.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Chưa có ảnh. Chụp món ăn, menu, mặt tiền để lần sau dễ nhận ra.</p>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink/90 p-4 animate-fade-in" onClick={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh lớn từ Cloudinary */}
          <img src={viewing.fullUrl} alt="" className="max-h-[80dvh] max-w-full rounded-sm object-contain" />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setViewing(null)} className="inline-flex min-h-11 items-center gap-1.5 rounded bg-white/10 px-4 text-sm font-semibold text-white">
              <X size={16} aria-hidden />
              Đóng
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(viewing.id, { onSuccess: () => setViewing(null) })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded bg-bad px-4 text-sm font-semibold text-white"
            >
              <Trash2 size={16} aria-hidden />
              Xóa ảnh
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
