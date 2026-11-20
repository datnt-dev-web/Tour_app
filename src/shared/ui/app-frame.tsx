import type { ReactNode } from 'react';

/** Khung mobile 480px ở giữa; withNav chừa 72px cho BottomNav. */
export function AppFrame({ children, withNav = false }: { children: ReactNode; withNav?: boolean }) {
  return (
    <div className={`mx-auto min-h-dvh max-w-[480px] bg-surface ${withNav ? 'pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))]' : ''}`}>{children}</div>
  );
}
