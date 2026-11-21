'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePushSubscription } from './use-push-subscription';

/**
 * Nút bật/tắt thông báo nhắc giờ (Web Push). btnClass do nơi đặt quyết định để hợp nền sáng/tối.
 * fallback hiện khi máy không dùng được push (vd. nhắc trong app lúc đang mở).
 */
export function PushToggle({ btnClass, hintClass = 'text-sm text-muted', fallback = null }: { btnClass: string; hintClass?: string; fallback?: ReactNode }) {
  const { state, busy, error, enable, disable } = usePushSubscription();

  if (state === 'loading') return null;
  if (state === 'unsupported') return fallback;
  if (state === 'needs-install') return <p className={hintClass}>iPhone: bấm Chia sẻ → “Thêm vào MH chính”, mở app từ biểu tượng đó rồi bật thông báo nhắc giờ.</p>;
  if (state === 'denied') return <p className={hintClass}>Bạn đã chặn thông báo của app. Bật lại trong cài đặt trình duyệt để được nhắc giờ.</p>;

  return (
    <>
      {state === 'on' ? (
        <button type="button" disabled={busy} onClick={() => void disable()} className={btnClass} aria-pressed="true">
          <BellRing size={16} aria-hidden />
          Đang bật thông báo
          <BellOff size={14} aria-hidden className="opacity-60" />
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void enable()} className={btnClass} aria-pressed="false">
          <Bell size={16} aria-hidden />
          {busy ? 'Đang bật…' : 'Bật thông báo nhắc giờ'}
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-bad">
          {error}
        </p>
      )}
    </>
  );
}
