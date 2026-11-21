'use client';

import { Compass, FolderOpen, Luggage, Map, NotebookText, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/** `/trips/*?view=map` thuộc tab Bản đồ; các trang `/trips/*` còn lại thuộc tab Chuyến đi. */
export const isTabActive = (href: string, pathname: string, view: string | null = null) => {
  const tripMap = pathname.startsWith('/trips/') && view === 'map';
  if (href === '/') return pathname === '/' || (pathname.startsWith('/trips/') && !tripMap);
  if (href === '/map') return pathname === '/map' || tripMap;
  return pathname.startsWith(href);
};

export const NAV_TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/', label: 'Chuyến đi', Icon: Luggage },
  { href: '/map', label: 'Bản đồ', Icon: Map },
  { href: '/explore', label: 'Khám phá', Icon: Compass },
  { href: '/book', label: 'Sổ quán', Icon: NotebookText },
  { href: '/info', label: 'Thông tin', Icon: FolderOpen },
];

export function BottomNav() {
  const pathname = usePathname();
  const view = useSearchParams().get('view');

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))] max-w-[480px] pb-[env(safe-area-inset-bottom)] border-t border-line bg-white"
    >
      {NAV_TABS.map(({ href, label, Icon }) => {
        const active = isTabActive(href, pathname, view);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`pressable relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold ${
              active ? 'text-accent' : 'text-muted'
            }`}
          >
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 mx-auto h-0.5 w-8 origin-center bg-accent transition-[transform,opacity] duration-(--dur-base) ease-(--ease-out) ${
                active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
              }`}
            />
            <Icon size={22} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
