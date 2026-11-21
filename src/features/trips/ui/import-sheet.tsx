'use client';

import { Download, X } from 'lucide-react';
import { useId, useState } from 'react';
import { CATEGORY_LABELS } from '@/features/places/constants';
import { Button } from '@/shared/ui/button';
import { celebrate } from '@/shared/ui/celebrate';
import { IMPORT_MAX_BYTES } from '../constants';
import { useImportPlaces, usePreviewImport } from './use-import-places';

const PREVIEW_ROWS = 5;

/** Bottom sheet nhập danh sách chỗ từ file .xlsx/.csv vào một chuyến: tải mẫu → chọn file → xem trước → nhập. */
export function ImportSheet({ tripId, tripName, onClose }: { tripId: string; tripName: string; onClose: () => void }) {
  const fileId = useId();
  const preview = usePreviewImport();
  const save = useImportPlaces(tripId);
  const rows = preview.data?.rows ?? [];
  const errors = preview.data?.errors ?? [];
  const busy = preview.isPending || save.isPending;

  const [tooBig, setTooBig] = useState(false);

  function pick(file: File | undefined) {
    if (!file) return;
    save.reset();
    preview.reset();
    // Chặn sớm ở máy cho khỏi gửi file lớn đi rồi mới bị từ chối; server vẫn kiểm lại.
    setTooBig(file.size > IMPORT_MAX_BYTES);
    if (file.size <= IMPORT_MAX_BYTES) preview.mutate(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nhập danh sách từ file"
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex max-h-[90dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-sm bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Nhập danh sách từ file</h2>
            <p className="truncate text-sm text-muted">Vào chuyến {tripName}. Lịch và tiền chốt sau trong app.</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center pressable rounded hover:bg-surface"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <a
          href="/api/trips/import-template"
          download
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line px-4 text-sm font-semibold text-accent pressable hover:bg-surface"
        >
          <Download size={18} aria-hidden />
          Tải file mẫu (Excel)
        </a>

        <label htmlFor={fileId} className="flex flex-col gap-1 text-sm font-medium">
          Chọn file đã điền (.xlsx hoặc .csv, tối đa 1 MB)
          <input
            id={fileId}
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              // Xóa lựa chọn để chọn lại đúng file đó (vừa sửa trong Excel) vẫn kích hoạt onChange.
              e.currentTarget.value = '';
            }}
            className="text-sm file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-surface file:px-4 file:font-semibold"
          />
        </label>

        {preview.isPending && <p className="text-sm text-muted">Đang đọc file…</p>}
        {tooBig && (
          <p role="alert" className="text-sm text-bad">
            File quá lớn (tối đa 1 MB).
          </p>
        )}
        {preview.error && (
          <p role="alert" className="text-sm text-bad">
            {preview.error.message}
          </p>
        )}

        {preview.data && !save.data && (
          <section aria-live="polite" className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              <span className="text-good">✓ {rows.length} dòng hợp lệ</span>
              {errors.length > 0 && <span className="text-bad"> · ✗ {errors.length} dòng lỗi</span>}
            </p>
            {errors.length > 0 && (
              <ul className="flex flex-col gap-1 rounded bg-bad-bg p-2 text-sm text-bad">
                {errors.map((e) => (
                  <li key={e.line}>
                    Dòng {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {rows.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <li key={r.name} className="truncate">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted"> · {CATEGORY_LABELS[r.category]}</span>
                  </li>
                ))}
                {rows.length > PREVIEW_ROWS && <li className="text-muted">… và {rows.length - PREVIEW_ROWS} chỗ nữa</li>}
              </ul>
            )}
            <Button
              disabled={rows.length === 0 || busy}
              onClick={() =>
                save.mutate(rows, {
                  onSuccess: (r) => r.added > 0 && celebrate(),
                })
              }
            >
              {save.isPending ? 'Đang nhập…' : `Nhập ${rows.length} chỗ`}
            </Button>
          </section>
        )}

        {save.error && (
          <p role="alert" className="text-sm text-bad">
            {save.error.message}
          </p>
        )}
        {save.data && (
          <div role="status" className="flex flex-col gap-2">
            <p className="rounded bg-good-bg p-2 text-sm text-good">
              Đã thêm {save.data.added} chỗ
              {save.data.skipped > 0 && `, bỏ qua ${save.data.skipped} chỗ đã có trong chuyến`}.
            </p>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
