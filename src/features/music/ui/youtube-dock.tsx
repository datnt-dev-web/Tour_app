'use client';

import { GripHorizontal, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type Box = { top: number; left: number; width: number; height: number };
type Point = { x: number; y: number };

/** Khung nổi: video 200×200 (tối thiểu theo điều khoản YouTube) + thanh kéo phía trên. */
const DOCK_SIZE = 200;
const HANDLE_H = 32;
const EDGE = 8;
const POSITION_KEY = 'ft:youtube-dock';

function clamp({ x, y }: Point): Point {
  const maxX = window.innerWidth - DOCK_SIZE - EDGE;
  const maxY = window.innerHeight - DOCK_SIZE - HANDLE_H - EDGE;
  return { x: Math.min(Math.max(EDGE, x), Math.max(EDGE, maxX)), y: Math.min(Math.max(EDGE, y), Math.max(EDGE, maxY)) };
}

function readPosition(): Point | null {
  try {
    const p = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as Point | null;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
}

/** Theo dõi vị trí ô giữ chỗ trên màn hình (cuộn trang, đổi cỡ, nội dung phía trên dài ra). */
function useSlotBox(slot: HTMLElement | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    if (!slot) return;
    const update = () => {
      const r = slot.getBoundingClientRect();
      setBox((b) => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height ? b : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(slot);
    ro.observe(document.body);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [slot]);
  return slot ? box : null;
}

/**
 * Một iframe YouTube duy nhất cho cả app (chuyển iframe sang chỗ khác trong DOM sẽ nạp lại video, ngắt nhạc).
 * Ở tab Nhạc: đặt khít lên ô giữ chỗ trong thẻ "Đang phát" như giao diện thường.
 * Ở tab khác: khung nhỏ nổi, kéo thanh phía trên để đổi chỗ (nhớ vị trí trên máy này).
 */
export function YoutubeDock({ slot, onClose, children }: { slot: HTMLElement | null; onClose: () => void; children: ReactNode }) {
  const box = useSlotBox(slot);
  const [pos, setPos] = useState<Point | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  // Đọc vị trí đã lưu sau khi gắn (localStorage không có lúc render phía server).
  useEffect(() => {
    const saved = readPosition();
    if (saved) queueMicrotask(() => setPos(clamp(saved)));
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  }
  function moveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  }
  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    try {
      if (pos) localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch {
      // Không lưu được (chế độ ẩn danh): lần sau về vị trí mặc định.
    }
  }

  // Cùng một cây phần tử cho cả hai chế độ: đổi cấu trúc thì React gắn lại iframe và nhạc bị ngắt.
  const docked = !slot;
  const outerStyle = slot
    ? box
      ? { top: box.top, left: box.left, width: box.width, height: box.height }
      : // Chưa đo xong ô giữ chỗ thì ẩn, tránh nháy ở góc màn hình.
        { visibility: 'hidden' as const }
    : pos
      ? { left: pos.x, top: pos.y }
      : undefined;

  return (
    <div
      ref={frame}
      style={outerStyle}
      className={
        slot
          ? 'fixed z-30 flex flex-col overflow-hidden rounded bg-black'
          : `fixed z-40 flex w-[200px] flex-col overflow-hidden rounded-lg shadow-card ring-1 ring-black/20 ${
              pos ? '' : 'right-[max(8px,calc(50vw-232px))] bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+3.5rem+8px)]'
            }`
      }
    >
      {docked && (
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex h-8 shrink-0 cursor-grab touch-none select-none items-center justify-between bg-black/85 pl-2 text-white active:cursor-grabbing"
          aria-label="Kéo để di chuyển khung video"
        >
          <GripHorizontal size={18} aria-hidden className="text-white/70" />
          <button type="button" onClick={onClose} aria-label="Tắt video YouTube" className="inline-flex size-8 items-center justify-center pressable">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      <div className={`bg-black [&_iframe]:size-full ${docked ? 'size-[200px]' : 'min-h-0 flex-1'}`}>{children}</div>
    </div>
  );
}
