'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlaceSummary } from '@/integrations/gemini/parse';
import type { PlaceCategory } from '@/integrations/google-places/types';
import { queryKeys } from '@/shared/query/keys';
import type { AiStatus } from '../services/quota';
import type { HotPlace } from '../services/ai-service';

const FALLBACK_ERROR = 'AI đang bận, thử lại sau.';

/** Lỗi từ /api/ai/*; message đã là tiếng Việt, hiện thẳng cho người dùng. */
export class AiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  throw new AiRequestError(body?.error?.code ?? 'AI_UNAVAILABLE', body?.error?.message ?? FALLBACK_ERROR);
}

const post = <T>(url: string, body: unknown) =>
  request<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const aiErrorMessage = (e: unknown) => (e instanceof AiRequestError ? e.message : FALLBACK_ERROR);

export function useAiStatus() {
  return useQuery({ queryKey: queryKeys.aiStatus, queryFn: () => request<AiStatus>('/api/ai/status') });
}

/** Sau mỗi lần gọi (kể cả lỗi, vì lượt có thể đã hoàn) làm mới số lượt còn lại. */
function useRefreshStatus() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.aiStatus });
}

export function useAiSummary(placeKey: string) {
  const refresh = useRefreshStatus();
  return useMutation({
    mutationKey: queryKeys.aiSummary(placeKey),
    mutationFn: () => post<PlaceSummary & { remainingToday: number }>('/api/ai/summary', { placeKey }),
    onSettled: refresh,
  });
}

export function useHotPlaces() {
  const refresh = useRefreshStatus();
  return useMutation({
    mutationFn: (v: { city: string; category: PlaceCategory }) => post<{ places: HotPlace[] }>('/api/ai/hot', v).then((r) => r.places),
    onSettled: refresh,
  });
}

/** Lý do không cho bấm nút AI, hoặc null khi còn lượt. */
export function aiBlockedReason(status: AiStatus | undefined): string | null {
  if (!status) return null;
  if (status.monthlyCapReached) return 'Tháng này AI đã hết lượt chung, thử lại sau.';
  if (status.remainingToday <= 0) return 'Hôm nay nhóm đã dùng hết lượt AI.';
  return null;
}
