'use client';

import {
  skipToken,
  useQuery as useTanstackQuery,
  type DefaultError,
  type DefinedInitialDataOptions,
  type DefinedUseQueryResult,
  type QueryKey,
  type UndefinedInitialDataOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Tiền tố key tạm dùng trong lần render hydrate; không bao giờ được lưu xuống máy (xem provider). */
export const HYDRATING_KEY = '__hydrating__';

const noopSubscribe = () => () => {};

/**
 * Dùng thay useQuery của TanStack trong mọi component (ESLint chặn import thẳng).
 *
 * Vì sao: cache lưu trên máy được nạp lại ngay khi layout hydrate, còn các vùng <Suspense> (trang) hydrate sau.
 * Lúc vùng đó hydrate, useQuery thường đã thấy dữ liệu cũ trong cache (và bỏ qua initialData), trong khi HTML server
 * vẽ "đang tải" hoặc initialData: React báo lệch hydrate và dựng lại cả cây.
 *
 * Cách làm: đúng lần render hydrate (useSyncExternalStore trả snapshot server = false), đọc một key tạm chưa có trong cache
 * và không tải (skipToken), nên kết quả trùng HTML server: đang tải, hoặc đúng initialData. Ngay sau đó React render lại
 * với key thật và dữ liệu cache hiện ra. Render thường ở client (chuyển trang) thì dùng key thật ngay, không nháy thêm.
 */
export function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): DefinedUseQueryResult<TData, TError>;
export function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError>;
export function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError>;
export function useQuery(options: UseQueryOptions) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return useTanstackQuery(
    hydrated
      ? options
      : // gcTime 0: key tạm bị dọn ngay khi chuyển sang key thật.
        { ...options, queryKey: [HYDRATING_KEY, ...options.queryKey], queryFn: skipToken, gcTime: 0 },
  );
}
