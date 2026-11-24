'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../services/geo';

export type MyLocation =
  | { status: 'idle' | 'locating' | 'denied' | 'unavailable' }
  | { status: 'ok'; coords: LatLng; accuracy: number };

// Vị trí chỉ dùng trên trình duyệt, không gửi lên server.
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 };

/**
 * Chỉ hỏi quyền khi người dùng bấm (start), rồi theo dõi liên tục để chấm vị trí đi theo khi đang đi bộ.
 * `stop` tắt hẳn: ngừng theo dõi (đỡ tốn pin) và về trạng thái như chưa bấm.
 * `autoStart`: trình duyệt đã cho phép từ trước thì tự bật (không hiện hộp hỏi quyền nào), chưa thì vẫn chờ bấm.
 */
export function useMyLocation({ autoStart = false }: { autoStart?: boolean } = {}) {
  const [location, setLocation] = useState<MyLocation>({ status: 'idle' });
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'unavailable' });
      return;
    }
    if (watchId.current !== null) return;
    setLocation({ status: 'locating' });
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => setLocation({ status: 'ok', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy }),
      (err) => {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' });
      },
      WATCH_OPTIONS,
    );
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setLocation({ status: 'idle' });
  }, []);

  useEffect(() => {
    if (!autoStart || !navigator.permissions) return;
    let alive = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => alive && p.state === 'granted' && start())
      // Trình duyệt cũ không hỗ trợ hỏi trạng thái quyền: giữ nguyên, người dùng tự bấm.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [autoStart, start]);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  return { location, start, stop };
}
