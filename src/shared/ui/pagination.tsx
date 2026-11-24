'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { pageItems, pageSlice } from '@/shared/pagination';

const CELL = 'inline-flex size-9 items-center justify-center rounded-sm text-sm font-semibold tabular-nums pressable';

/** Số trang 1, 2, 3… kèm nút trước/sau; một trang thì không hiện gì. */
export function Pagination({ page, count, onChange, label = 'Phân trang' }: { page: number; count: number; onChange: (page: number) => void; label?: string }) {
  if (count <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1 py-2">
      <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${CELL} text-ink hover:bg-card disabled:opacity-30`}>
        <ChevronLeft size={18} aria-hidden />
      </button>
      {pageItems(page, count).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden className="inline-flex size-9 items-center justify-center text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Trang ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={`${CELL} ${p === page ? 'bg-accent text-white' : 'text-ink hover:bg-card'}`}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" aria-label="Trang sau" disabled={page >= count} onClick={() => onChange(page + 1)} className={`${CELL} text-ink hover:bg-card disabled:opacity-30`}>
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  );
}

/**
 * Phân trang danh sách đã tải đủ ở client (danh sách chuyến, thông tin, ảnh kỉ niệm: ít dữ liệu, tải một lần).
 * Danh sách dài và lọc ở database thì phân trang ở database như các trang chỗ của chuyến.
 */
export function useClientPages<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  return { ...pageSlice(items, page, pageSize), setPage };
}
