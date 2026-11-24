'use client';

import { Dropdown } from '@/shared/ui/dropdown';
import type { TripParticipant } from '../repositories/settle-repo';

/** Giá trị rỗng = "Chưa ghi ai trả" (Dropdown cần mọi lựa chọn là chuỗi). */
const NOBODY = '';

/**
 * Chọn người đã trả một khoản; "Chưa ghi ai trả" thì khoản đó chưa vào chia tiền.
 * `readOnly` (không phải admin): chỉ hiện ai trả, không chọn được.
 */
export function PayerSelect({
  label,
  value,
  participants,
  onChange,
  disabled,
  readOnly,
}: {
  label: string;
  value: string | null;
  participants: TripParticipant[];
  onChange: (paidBy: string | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const options = [{ value: NOBODY, label: 'Chưa ghi ai trả' }, ...participants.map((p) => ({ value: p.id, label: `${p.name} trả` }))];
  if (readOnly) {
    const current = options.find((o) => o.value === (value ?? NOBODY)) ?? options[0];
    return <p className="mt-1 text-xs font-semibold text-muted">{current.label}</p>;
  }
  return (
    <Dropdown
      label={label}
      value={value ?? NOBODY}
      options={options}
      onChange={(v) => onChange(v || null)}
      size="sm"
      disabled={disabled}
      className="mt-1 w-fit max-w-full"
    />
  );
}
