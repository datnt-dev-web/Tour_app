'use client';

import { useQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { staggerStyle } from '@/shared/ui/stagger';
import { Chip } from '@/shared/ui/chip';
import { BOOK_FILTERS, CATEGORY_LABELS, placeKeyOf } from '../constants';
import { filterBook, type BookRow, type BookVerdict } from '../services/book-service';
import { bookQuery } from './book-queries';
import { VerdictBadge } from './verdict-badge';

const SEARCH_DEBOUNCE_MS = 200;
/** Chỉ ảo hóa danh sách khi dài hơn ngưỡng này; ngắn hơn thì render thẳng cho đơn giản. */
const VIRTUAL_THRESHOLD = 50;
const ROW_ESTIMATE_PX = 96;

function BookRowItem({ row }: { row: BookRow }) {
  return (
    <Link href={`/places/${encodeURIComponent(placeKeyOf(row))}`} className="pressable flex min-h-11 flex-col gap-1 rounded border border-line bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold leading-snug">{row.name}</p>
        <VerdictBadge verdict={row.verdict} className="shrink-0" />
      </div>
      <p className="truncate text-sm text-muted">
        {CATEGORY_LABELS[row.category]}
        {row.address && ` · ${row.address}`}
      </p>
      {row.note && <p className="text-sm">{row.note}</p>}
    </Link>
  );
}

function VirtualRows({ rows }: { rows: BookRow[] }) {
  // Phần tử lưu bằng state (không đọc ref lúc render) để lấy khoảng cách từ đầu trang tới danh sách.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 6,
    scrollMargin: listEl?.offsetTop ?? 0,
  });
  return (
    <div ref={setListEl} style={{ height: virtualizer.getTotalSize() }} className="relative">
      {virtualizer.getVirtualItems().map((v) => (
        <div
          key={rows[v.index].placeId}
          data-index={v.index}
          ref={virtualizer.measureElement}
          style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
          className="absolute inset-x-0 top-0 pb-2"
        >
          <BookRowItem row={rows[v.index]} />
        </div>
      ))}
    </div>
  );
}

export function BookScreen({ groupId, initialRows }: { groupId: string; initialRows: BookRow[] }) {
  const { data } = useQuery({ ...bookQuery(groupId), initialData: initialRows });
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [verdict, setVerdict] = useState<BookVerdict | 'all'>('all');

  useEffect(() => {
    const t = setTimeout(() => setQ(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const rows = useMemo(() => filterBook(data, { q, verdict: verdict === 'all' ? undefined : verdict }), [data, q, verdict]);

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold">Sổ quán</h1>
        <p className="text-sm text-muted">{data.length} chỗ</p>
      </header>

      <label className="relative block">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tìm tên, địa chỉ hoặc ghi chú"
          aria-label="Tìm trong sổ quán"
          className="min-h-11 w-full rounded border border-line bg-white pl-10 pr-3 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Lọc theo đánh giá">
        {BOOK_FILTERS.map((f) => (
          <Chip key={f.value} selected={verdict === f.value} onClick={() => setVerdict(f.value)} className="shrink-0">
            {f.label}
          </Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {data.length === 0 ? 'Sổ quán còn trống. Chỗ nào nhóm thêm vào chuyến sẽ được lưu ở đây.' : 'Không có chỗ nào khớp.'}
        </p>
      ) : rows.length > VIRTUAL_THRESHOLD ? (
        <VirtualRows rows={rows} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.placeId} className="stagger" style={staggerStyle(i)}>
              <BookRowItem row={r} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-muted">Sổ quán gồm mọi chỗ nhóm từng lưu, kèm đánh giá mới nhất của nhóm.</p>
    </main>
  );
}
