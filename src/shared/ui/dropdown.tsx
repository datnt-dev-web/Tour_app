'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Lớp màu nền cho chấm tròn trước nhãn (ví dụ trạng thái), không có thì không vẽ chấm. */
  dot?: string;
}

const SIZES = {
  md: 'min-h-11 w-full px-3 text-sm',
  sm: 'min-h-9 px-3 text-xs',
} as const;
/** Mỗi dòng ~44px; không đủ chỗ phía dưới (sát thanh điều hướng) thì mở lên trên. */
const ROW_PX = 44;
const NAV_ROOM_PX = 96;

const Dot = ({ className }: { className?: string }) => (className ? <span aria-hidden className={`size-2 shrink-0 rounded-full ${className}`} /> : null);

/**
 * Dropdown tự vẽ thay cho <select> gốc (không tùy biến được giao diện): mẫu "select-only combobox" của ARIA APG,
 * focus ở nút, chọn bằng chuột hoặc ↑ ↓ Enter, Esc để đóng. `prefix` hiện trước giá trị (ví dụ "Ngày:").
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  prefix,
  className = '',
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  size?: keyof typeof SIZES;
  prefix?: string;
  className?: string;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function show() {
    const rect = root.current?.getBoundingClientRect();
    setUp(!!rect && window.innerHeight - rect.bottom < options.length * ROW_PX + NAV_ROOM_PX);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(v: T) {
    setOpen(false);
    if (v !== value) onChange(v);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`flex items-center gap-2 rounded border bg-white font-medium pressable hover:bg-surface ${SIZES[size]} ${open ? 'border-accent' : 'border-line'}`}
      >
        <Dot className={current.dot} />
        <span className="flex-1 truncate text-left">
          {prefix && <span className="text-muted">{prefix} </span>}
          {current.label}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} aria-hidden className={`shrink-0 text-muted transition-transform duration-(--dur-fast) ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`animate-fade-in absolute left-0 z-30 min-w-full w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded border border-line bg-white p-1 shadow-card ${
            up ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm ${i === active ? 'bg-surface' : ''}`}
            >
              <Dot className={o.dot} />
              <span className="flex-1">{o.label}</span>
              {o.value === value && <Check size={16} aria-hidden className="text-accent" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
