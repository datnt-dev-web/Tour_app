import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong active:bg-accent-strong',
  secondary: 'border border-line bg-card text-ink hover:bg-surface active:bg-line',
  ghost: 'text-accent hover:bg-surface',
  ai: 'bg-ai-bg text-ai hover:bg-ai-bg/70',
  /** Bước xác nhận của thao tác xóa. */
  danger: 'bg-bad text-white',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

/** Class của nút, dùng cho cả thẻ khác trông như nút (Link, label chọn file). */
export function buttonClass(variant: Variant = 'primary', className = '') {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold pressable disabled:opacity-50 ${VARIANTS[variant]} ${className}`;
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
