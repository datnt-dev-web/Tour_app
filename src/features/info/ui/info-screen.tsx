'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, FileText, Link2, StickyNote, Trash2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Skeleton } from '@/shared/ui/skeleton';
import type { InfoKind } from '../constants';
import type { TripInfo } from '../repositories/infos-repo';
import { AddInfoForm } from './add-info-form';
import { tripInfosQuery, useRemoveInfo } from './info-queries';

type TripOption = { id: string; name: string; city: string };

const ICONS: Record<InfoKind, LucideIcon> = { note: StickyNote, link: Link2, file: FileText };
const SKELETON_ROWS = 3;

function formatBytes(n: number | null): string {
  if (!n) return '';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
};

/** Tab Thông tin: chọn chuyến, xem/thêm/xóa ghi chú, link, tệp của chuyến đó. */
export function InfoScreen({ trips, selectedId, uploadEnabled }: { trips: TripOption[]; selectedId: string | null; uploadEnabled: boolean }) {
  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <h1 className="text-xl font-extrabold">Thông tin</h1>
      {trips.length === 0 || !selectedId ? (
        <p className="py-8 text-center text-sm text-muted">Chưa có chuyến nào. Tạo chuyến ở tab Chuyến đi rồi quay lại cất vé, link, ghi chú.</p>
      ) : (
        <>
          <nav aria-label="Chọn chuyến" className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
            {trips.map((t) => (
              <Link
                key={t.id}
                href={`/info?trip=${t.id}`}
                replace
                aria-current={t.id === selectedId ? 'page' : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-sm border px-4 text-sm font-medium pressable ${
                  t.id === selectedId ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-surface'
                }`}
              >
                {t.city} · {t.name}
              </Link>
            ))}
          </nav>
          {/* key: đổi chuyến thì form và danh sách làm mới hẳn, không giữ chữ đang gõ của chuyến trước. */}
          <TripInfoBoard key={selectedId} tripId={selectedId} uploadEnabled={uploadEnabled} />
        </>
      )}
    </main>
  );
}

function TripInfoBoard({ tripId, uploadEnabled }: { tripId: string; uploadEnabled: boolean }) {
  const { data, isPending, isError, error } = useQuery(tripInfosQuery(tripId));
  const remove = useRemoveInfo(tripId);

  return (
    <>
      <AddInfoForm tripId={tripId} uploadEnabled={uploadEnabled} />
      {remove.error && (
        <p role="alert" className="text-sm text-bad">
          {remove.error.message}
        </p>
      )}
      <section aria-live="polite" className="flex flex-col gap-2">
        {isPending ? (
          Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-16" />)
        ) : isError ? (
          <p className="py-8 text-center text-sm text-bad">{error.message}</p>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Chưa có gì. Thêm vé, xác nhận đặt phòng, link lịch trình, số điện thoại…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((item) => (
              <InfoRow key={item.id} item={item} onRemove={() => remove.mutate(item.id)} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const ACTION = 'inline-flex size-11 shrink-0 items-center justify-center rounded pressable hover:bg-surface';

function InfoRow({ item, onRemove }: { item: TripInfo; onRemove: () => void }) {
  // Xóa hai bước ngay trên dòng (không dùng hộp thoại của trình duyệt).
  const [confirming, setConfirming] = useState(false);
  const Icon = ICONS[item.kind];
  // Tệp: link ký và hết hạn được tạo lúc bấm (server chuyển hướng), không lưu sẵn trong danh sách.
  const fileHref = item.kind === 'file' ? `/api/infos/${item.id}/file` : null;
  const openHref = item.kind === 'link' ? item.url : fileHref;
  const sub = item.kind === 'link' ? hostOf(item.url) : item.kind === 'file' ? [item.file_name, formatBytes(item.file_bytes)].filter(Boolean).join(' · ') : null;

  return (
    <li className="flex items-start gap-2 rounded border border-line bg-card p-3">
      <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug break-words">{item.title}</p>
        {sub && <p className="truncate text-sm text-muted">{sub}</p>}
        {item.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p>}
      </div>
      {openHref && (
        <a href={openHref} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${item.title}`} className={`${ACTION} text-accent`}>
          <ExternalLink size={18} aria-hidden />
        </a>
      )}
      {fileHref && (
        <a href={`${fileHref}?download=1`} aria-label={`Tải ${item.title}`} className={`${ACTION} text-accent`}>
          <Download size={18} aria-hidden />
        </a>
      )}
      {confirming ? (
        <button type="button" onClick={onRemove} onBlur={() => setConfirming(false)} autoFocus className="min-h-11 shrink-0 rounded bg-bad px-3 text-sm font-semibold text-white pressable">
          Xóa?
        </button>
      ) : (
        <button type="button" aria-label={`Xóa ${item.title}`} onClick={() => setConfirming(true)} className={`${ACTION} text-bad`}>
          <Trash2 size={18} aria-hidden />
        </button>
      )}
    </li>
  );
}
