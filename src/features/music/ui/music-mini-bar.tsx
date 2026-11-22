'use client';

import { Music, Pause, Play, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMusicPlayer } from './music-player';

/** Thanh nhỏ phía trên thanh điều hướng khi đang có bài, để nghe tiếp lúc xem tab khác. Ở tab Nhạc thì không cần. */
export function MusicMiniBar() {
  const { current, playing, toggle, next } = useMusicPlayer();
  const pathname = usePathname();
  if (!current || pathname === '/music') return null;

  return (
    <>
      {/* Chừa chỗ cuối trang để thanh không che nội dung. */}
      <div aria-hidden className="h-14" />
      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom))] z-40 mx-auto flex h-14 max-w-[480px] items-center gap-2 border-t border-line bg-card px-2">
        <Link href="/music" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 pressable">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent/15 text-accent">
            <Music size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{current.title}</span>
            <span className="block truncate text-xs text-muted">{current.artist ?? (current.kind === 'youtube' ? 'YouTube' : 'Nhạc chung')}</span>
          </span>
        </Link>
        <button type="button" onClick={toggle} aria-label={playing ? 'Tạm dừng' : 'Phát'} className="inline-flex size-11 items-center justify-center rounded-full text-ink pressable hover:bg-surface">
          {playing ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
        </button>
        <button type="button" onClick={next} aria-label="Bài sau" className="inline-flex size-11 items-center justify-center rounded-full text-ink pressable hover:bg-surface">
          <SkipForward size={20} aria-hidden />
        </button>
      </div>
    </>
  );
}
