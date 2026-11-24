'use client';

import { useEffect, useState } from 'react';
import type { LatLng } from '../services/geo';
import type { StopDistances } from '../services/stop-distances';

type Result = { key: string; data?: StopDistances; error?: string };

/**
 * Quãng đường từ vị trí người xem link chia sẻ tới các chỗ. Trang chia sẻ không có QueryProvider (người xem không đăng nhập),
 * nên gọi thẳng: mỗi khi vị trí (đã làm tròn) hoặc danh sách chỗ đổi thì gọi lại một lần, bỏ kết quả của lượt cũ.
 */
export function useSharedDistances(token: string, ids: string[], origin: LatLng | null) {
  const key = origin && ids.length > 0 ? `${origin.lat},${origin.lng}|${ids.join(',')}` : '';
  const [result, setResult] = useState<Result>({ key: '' });

  useEffect(() => {
    if (!key || !origin) return;
    const ctrl = new AbortController();
    fetch(`/api/share/${token}/distances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, origin }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.ok) return setResult({ key, data: (await res.json()) as StopDistances });
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setResult({ key, error: body?.error?.message ?? 'Không tính được quãng đường, thử lại sau.' });
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setResult({ key, error: e instanceof Error ? e.message : 'Mất kết nối, thử lại sau.' });
      });
    return () => ctrl.abort();
    // key đã gói đủ ids + origin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);

  const current = result.key === key && key !== '' ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: key !== '' && !current };
}
