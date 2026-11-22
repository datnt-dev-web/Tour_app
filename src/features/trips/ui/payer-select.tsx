'use client';

import type { TripParticipant } from '../repositories/settle-repo';

/** Chọn người đã trả một khoản; "Chưa ghi ai trả" thì khoản đó chưa vào chia tiền. */
export function PayerSelect({
  label,
  value,
  participants,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  participants: TripParticipant[];
  onChange: (paidBy: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={`min-h-9 max-w-full rounded border bg-card px-2 text-xs disabled:opacity-50 ${value ? 'border-line text-ink' : 'border-dashed border-line text-muted'}`}
    >
      <option value="">Chưa ghi ai trả</option>
      {participants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} trả
        </option>
      ))}
    </select>
  );
}
