'use client';

import { Compass, Map, NotebookText, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Tab Chuyến đi gồm cả trang chi tiết chuyến `/trips/*`. */
export const isTabActive = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' || pathname.startsWith('/trips/') : pathname.startsWith(href);

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/', label: 'Chuyến đi', Icon: Map },
  { href: '/explore', label: 'Khám phá', Icon: Compass },
  { href: '/book', label: 'Sổ quán', Icon: NotebookText },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))] max-w-[480px] pb-[env(safe-area-inset-bottom)] border-t border-line bg-white"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isTabActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold ${
              active ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icon size={22} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
