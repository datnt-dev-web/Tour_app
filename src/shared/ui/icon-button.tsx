import type { ButtonHTMLAttributes } from 'react';

type Tone = 'plain' | 'accent' | 'danger' | 'muted' | 'outline' | 'solid' | 'overlay';

const TONES: Record<Tone, string> = {
  plain: 'hover:bg-surface',
  accent: 'text-accent hover:bg-surface',
  danger: 'text-bad hover:bg-surface',
  muted: 'text-muted hover:bg-surface',
  outline: 'border border-line bg-card text-ink hover:bg-surface',
  solid: 'bg-accent text-white hover:bg-accent-strong',
  overlay: 'bg-white/10 text-white hover:bg-white/20',
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: Tone; round?: boolean };

/** Class nút icon, dùng cho cả link trông như nút icon (chỉ đường, tải về, quay lại). */
export function iconButtonClass(tone: Tone = 'plain', round = false, className = '') {
  return `inline-flex size-11 shrink-0 items-center justify-center pressable disabled:opacity-50 ${round ? 'rounded-full' : 'rounded'} ${TONES[tone]} ${className}`;
}

/** Nút chỉ có icon, vùng chạm 44px; `label` là tên đọc cho trình đọc màn hình. */
export function IconButton({ label, tone = 'plain', round = false, className = '', type = 'button', ...props }: IconButtonProps) {
  return <button type={type} aria-label={label} className={iconButtonClass(tone, round, className)} {...props} />;
}
