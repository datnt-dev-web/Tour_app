'use client';

import { useEffect } from 'react';

/** Đăng ký service worker ở production; dev bỏ qua để không cache nhầm bản build cũ. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
