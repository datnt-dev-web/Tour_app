'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { formatVnd, parseMoney } from '@/shared/money';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'> & {
  value: number | null;
  /** Gọi khi rời ô hoặc Enter, chỉ khi giá trị hợp lệ và khác trước. */
  onCommit: (value: number | null) => void;
};

/**
 * Ô tiền VND: gõ tắt được "120k", "1tr2", "1.062.000"; lúc không gõ thì hiện dạng "120.000".
 * Gõ sai thì viền đỏ và giữ nguyên giá cũ.
 */
export function MoneyInput({ value, onCommit, className = '', ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : parseMoney(draft);
  const invalid = parsed === undefined;

  function commit() {
    if (draft === null) return;
    if (!invalid && parsed !== value) onCommit(parsed);
    if (!invalid) setDraft(null);
  }

  return (
    <input
      {...props}
      inputMode="numeric"
      autoComplete="off"
      aria-invalid={invalid || undefined}
      value={draft ?? (value === null ? '' : formatVnd(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(null);
        }
      }}
      className={`${className} tabular-nums ${invalid ? 'border-bad! text-bad' : ''}`}
    />
  );
}
