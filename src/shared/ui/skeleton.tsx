import type { HTMLAttributes } from 'react';

export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={`animate-pulse rounded bg-surface ${className}`} {...props} />;
}
