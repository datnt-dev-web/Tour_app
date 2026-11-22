'use client';

import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronLeft, ChevronRight, Download, ImagePlus, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { Skeleton } from '@/shared/ui/skeleton';
import { runLimited, uploadWithTicket } from '@/shared/upload/direct-upload';
import { addMemoryAction, prepareMemoryUploadsAction, removeMemoryAction } from '../actions/memories-actions';
import { MEMORY_BATCH_MAX, MEMORY_MAX_BYTES } from '../constants';
import type { TripPhotoView } from '../services/memories-service';
import { CameraCapture } from './camera-capture';

const PARALLEL_UPLOADS = 3;
const SKELETON_TILES = 6;

const memoriesQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripPhotos(tripId),
    // Link tải ảnh gốc hết hạn sau 1 giờ: coi là cũ sớm để mở lại là có link mới.
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ photos: TripPhotoView[]; enabled: boolean }> => {
      const res = await fetch(`/api/trips/${tripId}/photos`);
      if (!res.ok) throw new Error('Không tải được ảnh, thử lại sau.');
      return res.json();
    },
  });

/** Ảnh kỉ niệm của một chuyến: chọn nhiều ảnh tải thẳng lên Cloudinary, lưới ảnh, xem lớn. */
export function MemoriesBoard({ tripId }: { tripId: string }) {
  const inputId = useId();
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery(memoriesQuery(tripId));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [camera, setCamera] = useState(false);
  const photos = data?.photos ?? [];

  async function upload(files: File[]) {
    setProblem(null);
    const tooBig = files.filter((f) => f.size > MEMORY_MAX_BYTES);
    const ok = files.filter((f) => f.size <= MEMORY_MAX_BYTES).slice(0, MEMORY_BATCH_MAX);
    const notes: string[] = [];
    if (tooBig.length) notes.push(`${tooBig.length} ảnh quá ${MEMORY_MAX_BYTES / 1_000_000} MB bị bỏ qua.`);
    if (files.length - tooBig.length > MEMORY_BATCH_MAX) notes.push(`Mỗi lần tối đa ${MEMORY_BATCH_MAX} ảnh, phần còn lại chọn lần sau.`);
    if (ok.length === 0) return setProblem(notes.join(' ') || null);

    setProgress({ done: 0, total: ok.length });
    let failed = 0;
    try {
      const tickets = unwrap(await prepareMemoryUploadsAction({ tripId, count: ok.length }));
      await runLimited(ok, PARALLEL_UPLOADS, async (file, i) => {
        try {
          const publicId = await uploadWithTicket(tickets[i], file);
          unwrap(await addMemoryAction({ tripId, publicId }));
        } catch {
          failed++;
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      });
      if (failed) notes.push(`${failed} ảnh tải lỗi, thử lại sau.`);
    } catch (e) {
      notes.push(e instanceof Error ? e.message : 'Không tải được ảnh, thử lại sau.');
    } finally {
      setProgress(null);
      setProblem(notes.join(' ') || null);
      await qc.invalidateQueries({ queryKey: queryKeys.tripPhotos(tripId) });
    }
  }

  async function remove(id: string) {
    try {
      unwrap(await removeMemoryAction({ id }));
      setViewing(null);
      await qc.invalidateQueries({ queryKey: queryKeys.tripPhotos(tripId) });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Không xóa được ảnh.');
    }
  }

  if (data && !data.enabled) return <p className="py-8 text-center text-sm text-muted">Chưa cấu hình lưu ảnh (Cloudinary). Liên hệ admin.</p>;
  const current = viewing === null ? null : photos[viewing];

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{isPending ? 'Đang tải…' : `${photos.length} ảnh`}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!!progress}
            onClick={() => setCamera(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded border border-line bg-card px-3 text-sm font-semibold text-ink pressable hover:bg-surface disabled:opacity-60"
          >
            <Camera size={18} aria-hidden />
            Chụp ảnh
          </button>
          <label
            htmlFor={inputId}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded bg-accent px-4 text-sm font-semibold text-white pressable hover:bg-accent-strong ${progress ? 'pointer-events-none opacity-60' : ''}`}
          >
            <ImagePlus size={18} aria-hidden />
            {progress ? `Đang tải ${progress.done}/${progress.total}` : 'Thêm ảnh'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.currentTarget.value = '';
              if (files.length) void upload(files);
            }}
          />
        </div>
      </div>
      {camera && (
        <CameraCapture
          onClose={() => setCamera(false)}
          onDone={(files) => {
            setCamera(false);
            void upload(files);
          }}
        />
      )}
      {problem && (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      )}

      {isPending ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: SKELETON_TILES }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-sm" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-bad">{error.message}</p>
      ) : photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Chưa có ảnh nào. Thêm ảnh chụp trong chuyến để cả nhóm cùng xem lại.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => setViewing(i)} className="block aspect-square w-full overflow-hidden rounded-sm bg-surface pressable" aria-label={`Xem ảnh ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary đã thu nhỏ sẵn, link ký riêng */}
                <img src={p.thumbUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && viewing !== null && (
        <Lightbox
          key={current.id}
          photo={current}
          index={viewing}
          total={photos.length}
          onClose={() => setViewing(null)}
          onMove={(d) => setViewing((v) => (v === null ? v : (v + d + photos.length) % photos.length))}
          onRemove={() => void remove(current.id)}
        />
      )}
    </section>
  );
}

const ICON_BTN = 'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white pressable hover:bg-white/20';

function Lightbox({ photo, index, total, onClose, onMove, onRemove }: { photo: TripPhotoView; index: number; total: number; onClose: () => void; onMove: (delta: number) => void; onRemove: () => void }) {
  // Xóa hai bước ngay trên thanh công cụ (không dùng hộp thoại của trình duyệt).
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh ${index + 1}/${total}`}
      className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-black/95"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') onMove(1);
        if (e.key === 'ArrowLeft') onMove(-1);
      }}
    >
      <div className="flex items-center justify-between gap-2 p-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button type="button" autoFocus onClick={onClose} aria-label="Đóng" className={ICON_BTN}>
          <X size={20} aria-hidden />
        </button>
        <span className="text-sm text-white/70">
          {index + 1}/{total}
        </span>
        <div className="flex gap-2">
          <a href={photo.downloadUrl} aria-label="Tải ảnh gốc" className={ICON_BTN}>
            <Download size={20} aria-hidden />
          </a>
          {confirming ? (
            <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center rounded-full bg-bad px-4 text-sm font-semibold text-white pressable">
              Xóa ảnh này?
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} aria-label="Xóa ảnh" className={ICON_BTN}>
              <Trash2 size={20} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary cỡ lớn, link ký riêng */}
        <img src={photo.fullUrl} alt="" className="max-h-full max-w-full object-contain" />
        {total > 1 && (
          <>
            <button type="button" onClick={() => onMove(-1)} aria-label="Ảnh trước" className={`${ICON_BTN} absolute left-2`}>
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" onClick={() => onMove(1)} aria-label="Ảnh sau" className={`${ICON_BTN} absolute right-2`}>
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
