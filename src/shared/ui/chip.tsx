import type { ButtonHTMLAttributes } from 'react';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean };

export function Chip({ selected = false, className = '', type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center gap-1 rounded-sm border px-4 text-sm font-medium pressable ${
        selected ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink hover:bg-surface'
      } ${className}`}
      {...props}
    />
  );
}
