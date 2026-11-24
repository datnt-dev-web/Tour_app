'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';
import { IconButton, type IconButtonProps } from './icon-button';

/**
 * Nút xóa hai bước dùng chung: bấm thùng rác thì hiện "Xóa?" màu đỏ, bấm lần nữa mới xóa; bấm ra chỗ khác là thôi.
 * Mọi thao tác xóa trong app đều phải qua bước xác nhận này (hoặc một bước xác nhận riêng có nêu rõ thứ bị xóa).
 */
export function ConfirmDeleteButton({
  label,
  onConfirm,
  confirmText = 'Xóa?',
  tone = 'danger',
  disabled,
  className = '',
  iconSize = 18,
}: {
  /** Mô tả cho trình đọc màn hình, vd. "Xóa Bánh đa cua khỏi chuyến". */
  label: string;
  onConfirm: () => void;
  confirmText?: string;
  tone?: IconButtonProps['tone'];
  disabled?: boolean;
  className?: string;
  iconSize?: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Button
        variant="danger"
        aria-label={`Xác nhận: ${label}`}
        disabled={disabled}
        autoFocus
        onBlur={() => setConfirming(false)}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className="shrink-0 px-3"
      >
        {confirmText}
      </Button>
    );
  }
  return (
    <IconButton label={label} tone={tone} disabled={disabled} onClick={() => setConfirming(true)} className={className}>
      <Trash2 size={iconSize} aria-hidden />
    </IconButton>
  );
}
