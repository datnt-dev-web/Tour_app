'use client';

import { onlineManager, useIsMutating } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);

/** Thanh nhỏ khi mất mạng; thao tác lúc offline được React Query giữ lại và tự gửi khi có mạng. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => onlineManager.isOnline(), () => true);
  const waiting = useIsMutating();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center gap-2 bg-ink px-3 py-2 text-xs font-semibold text-white">
      <WifiOff size={14} aria-hidden />
      Đang offline: xem được dữ liệu đã lưu{waiting > 0 ? ` · ${waiting} thay đổi sẽ gửi khi có mạng` : ''}.
    </div>
  );
}
