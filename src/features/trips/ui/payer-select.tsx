'use client';

import { Dropdown } from '@/shared/ui/dropdown';
import type { TripParticipant } from '../repositories/settle-repo';

/** Giá trị rỗng = "Chưa ghi ai trả" (Dropdown cần mọi lựa chọn là chuỗi). */
const NOBODY = '';

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
  const options = [{ value: NOBODY, label: 'Chưa ghi ai trả' }, ...participants.map((p) => ({ value: p.id, label: `${p.name} trả` }))];
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
