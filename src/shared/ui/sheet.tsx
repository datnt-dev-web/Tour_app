'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './icon-button';

const HEIGHTS = { md: 'max-h-[70dvh]', lg: 'max-h-[90dvh]' } as const;

/** Bottom sheet dùng chung: nền mờ (chạm để đóng), tiêu đề + mô tả, nút đóng, nội dung cuộn được. */
export function Sheet({
  title,
  description,
  onClose,
  children,
  height = 'lg',
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  height?: keyof typeof HEIGHTS;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`animate-sheet-up flex w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-sm bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${HEIGHTS[height]} ${className}`}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">{title}</h2>
            {description && <div className="text-sm text-muted">{description}</div>}
          </div>
          <IconButton label="Đóng" onClick={onClose}>
            <X size={20} aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
