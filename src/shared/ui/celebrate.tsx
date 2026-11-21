'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const EVENT = 'ft:celebrate';
/** WebP động (nhẹ hơn GIF gốc ~65%, vẫn trong suốt); bản gốc ở assets/meme.gif. */
const MEME_SRC = '/gifs/meme.webp';
/** Cứ mỗi khoảng này meme ngoi lên một lần (lần đầu sau chừng ấy kể từ khi vào app). */
const INTERVAL_MS = 10_000;
const SHOW_MS = 3200;
const OUT_MS = 450;

/** Gọi sau khi tạo chuyến mới (hoặc dịp đáng mừng khác) để meme ngoi lên ngay, không chờ tới lượt. */
export function celebrate() {
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Meme góc dưới bên trái: cứ 10 giây ngoi lên một lần, và ngay khi `celebrate()`. Ngoi từ dưới lên kiểu lò xo,
 * đứng một lúc rồi lặn xuống; bấm vào thì lặn luôn. Tab bị ẩn thì tạm dừng (đỡ tốn pin, khỏi dồn lượt).
 * Ảnh được tải trước lúc trình duyệt rảnh (không tranh băng thông lúc tải trang), nên lần ngoi đầu đã có ảnh.
 */
export function CelebrateGif() {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => timers.current.forEach((t) => window.clearTimeout(t));
    const hide = () => {
      clear();
      setPhase('out');
      timers.current = [window.setTimeout(() => setPhase('hidden'), OUT_MS)];
    };
    const show = () => {
      clear();
      setPhase('in');
      timers.current = [window.setTimeout(hide, SHOW_MS)];
    };
    window.addEventListener(EVENT, show);

    // setInterval chạy được cả khi StrictMode gắn effect hai lần: lần đầu bị dọn ngay, lần sau mới là lần thật.
    let interval: number | undefined;
    const start = () => {
      window.clearInterval(interval);
      interval = window.setInterval(show, INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) window.clearInterval(interval);
      else start();
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    // requestIdleCallback chưa có trên Safari: lùi về setTimeout.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => {
      new window.Image().src = MEME_SRC;
    });

    return () => {
      window.removeEventListener(EVENT, show);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      clear();
    };
  }, []);

  if (phase === 'hidden') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-w-[480px] px-3">
      <button
        type="button"
        aria-label="Ẩn"
        onClick={() => setPhase('out')}
        onAnimationEnd={() => phase === 'out' && setPhase('hidden')}
        // Không dùng filter (drop-shadow) trên GIF động: trình duyệt phải vẽ lại bóng ở mọi khung hình, rất nặng.
        className={`pointer-events-auto block size-24 origin-bottom will-change-transform ${phase === 'in' ? 'animate-meme-in' : 'animate-meme-out'}`}
      >
        <Image src={MEME_SRC} alt="" width={96} height={96} unoptimized />
      </button>
    </div>
  );
}
