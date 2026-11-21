'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import type { GeoSuggestion, SuggestKind } from '@/integrations/photon/client';
import { queryKeys } from '@/shared/query/keys';
import { useDebouncedValue } from '@/shared/ui/use-debounced-value';
import { MIN_SUGGEST_CHARS } from '../constants';

/** Chờ người dùng ngừng gõ rồi mới hỏi server. */
export const SUGGEST_DEBOUNCE_MS = 300;
const SUGGEST_STALE_MS = 5 * 60 * 1000;

async function fetchSuggestions(kind: SuggestKind, q: string, city: string | undefined, signal: AbortSignal): Promise<GeoSuggestion[]> {
  const qs = new URLSearchParams({ q, kind });
  if (city) qs.set('city', city);
  const res = await fetch(`/api/geo/suggest?${qs}`, { signal });
  if (!res.ok) throw new Error('suggest failed');
  return ((await res.json()) as { suggestions: GeoSuggestion[] }).suggestions;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  kind: SuggestKind;
  /** Thành phố ưu tiên khi gợi ý địa chỉ. */
  city?: string;
  /** Mặc định điền `label` vào ô; truyền vào để làm khác (ví dụ ô thành phố chỉ lấy tên). */
  onPick?: (s: GeoSuggestion) => void;
  /** Khung định vị danh sách gợi ý; mặc định là chính ô nhập. */
  wrapperClassName?: string;
};

/** Ô nhập có danh sách gợi ý địa chỉ/thành phố (combobox). Lỗi gợi ý thì im lặng, người dùng vẫn gõ tay được. */
export function SuggestInput({ value, onChange, kind, city, onPick, wrapperClassName = 'relative', ...inputProps }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = useDebouncedValue(value.trim(), SUGGEST_DEBOUNCE_MS);

  const { data = [] } = useQuery({
    queryKey: queryKeys.geoSuggest(kind, q, city),
    // signal: gõ tiếp thì React Query hủy request cũ thay vì để nó chạy hết.
    queryFn: ({ signal }) => fetchSuggestions(kind, q, city, signal),
    enabled: open && q.length >= MIN_SUGGEST_CHARS,
    staleTime: SUGGEST_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
  // Ô đã đúng bằng gợi ý vừa chọn thì không mở lại danh sách.
  const items = data.filter((s) => s.label !== value);
  const shown = open && value.trim().length >= MIN_SUGGEST_CHARS && items.length > 0;

  function pick(s: GeoSuggestion) {
    if (onPick) onPick(s);
    else onChange(s.label);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={wrapperClassName}>
      <input
        {...inputProps}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          className="animate-fade-in absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded border border-line bg-card shadow-card"
        >
          {items.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown chặn blur của ô nhập trước khi click kịp chọn.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? 'bg-surface' : 'hover:bg-surface'}`}
            >
              <MapPin size={16} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{s.name}</span>
                {s.label !== s.name && <span className="block truncate text-xs text-muted">{s.label}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
