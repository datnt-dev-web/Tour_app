import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'good' | 'bad' | 'ai' | 'warn' | 'accent';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-muted',
  good: 'bg-good-bg text-good',
  bad: 'bg-bad-bg text-bad',
  ai: 'bg-ai-bg text-ai',
  warn: 'bg-warn-bg text-warn',
  accent: 'bg-highlight text-deep',
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}
