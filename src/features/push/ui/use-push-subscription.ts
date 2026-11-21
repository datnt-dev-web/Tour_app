'use client';

import { useCallback, useEffect, useState } from 'react';
import { unwrap } from '@/shared/actions';
import { subscribePushAction, unsubscribePushAction } from '../actions/push-actions';

/**
 * unsupported: trình duyệt không có Web Push, chưa cấu hình khóa, hoặc chưa có service worker (bản dev);
 * needs-install: iPhone/iPad chỉ nhận push khi mở từ biểu tượng ngoài màn hình chính (iOS 16.4+).
 */
export type PushState = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Khóa VAPID dạng base64url → mảng byte cho pushManager.subscribe. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosBrowserTab(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function saveOnServer(sub: PushSubscription) {
  const json = sub.toJSON();
  unwrap(await subscribePushAction({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }));
}

async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const reg = await currentRegistration();
      let next: PushState;
      if (!reg) next = isIosBrowserTab() && PUBLIC_KEY ? 'needs-install' : 'unsupported';
      else if (Notification.permission === 'denied') next = 'denied';
      else {
        const sub = await reg.pushManager.getSubscription();
        // Đồng bộ lại với server mỗi lần mở: DB có thể đã mất dòng (đổi người trên máy, đăng ký bị dọn).
        if (sub) await saveOnServer(sub).catch(() => {});
        next = sub ? 'on' : 'off';
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await currentRegistration();
      if (!reg || !PUBLIC_KEY) return setState('unsupported');
      if ((await Notification.requestPermission()) !== 'granted') return setState(Notification.permission === 'denied' ? 'denied' : 'off');
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      await saveOnServer(sub);
      setState('on');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không bật được thông báo, thử lại sau.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await (await currentRegistration())?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction({ endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
