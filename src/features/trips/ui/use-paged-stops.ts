'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/shared/query/keys';
import { pageCount } from '@/shared/pagination';
import { STOPS_PAGE_SIZE, type StopsPage, type StopsQuery, type TripStop } from '../repositories/trips-repo';
import { tripStopsQuery } from './trip-queries';

export type StopsFilter = Omit<StopsQuery, 'page'>;
/** Trang đầu đã tải sẵn ở server cho đúng bộ lọc mặc định của tab đang mở. */
export interface InitialStops {
  query: StopsQuery;
  data: StopsPage;
}

const sameQuery = (a: StopsQuery, b: StopsQuery) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Một danh sách chỗ phân trang ở database (số trang 1, 2, 3…). Đổi bộ lọc thì về trang 1;
 * tổng giảm (nhóm vừa xóa bớt) mà đang ở trang vượt quá thì lùi về trang cuối.
 */
export function usePagedStops(tripId: string, filter: StopsFilter, initial?: InitialStops) {
  const filterKey = JSON.stringify(filter);
  const [state, setState] = useState({ filterKey, page: 1 });
  if (state.filterKey !== filterKey) setState({ filterKey, page: 1 });
  const page = state.filterKey === filterKey ? state.page : 1;

  const query: StopsQuery = { ...filter, page };
  const { data, isPending, isError, isPlaceholderData } = useQuery({
    ...tripStopsQuery(tripId, query),
    initialData: initial && sameQuery(initial.query, query) ? initial.data : undefined,
  });

  const count = pageCount(data?.total ?? 0, STOPS_PAGE_SIZE);
  if (data && !isPlaceholderData && page > count) setState({ filterKey, page: count });

  // Tải sẵn trang kế tiếp khi trang hiện tại đã xong, để bấm "trang sau" là có ngay.
  const qc = useQueryClient();
  const hasNext = !!data && !isPlaceholderData && page < count;
  useEffect(() => {
    if (hasNext) void qc.prefetchQuery(tripStopsQuery(tripId, { ...JSON.parse(filterKey), page: page + 1 }));
  }, [qc, hasNext, tripId, filterKey, page]);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page,
    count,
    isPending,
    isError,
    /** Đang tải trang mới (vẫn hiện trang cũ). */
    isSwitching: isPlaceholderData,
    setPage: (p: number) => setState({ filterKey, page: p }),
  };
}

/** Mọi chỗ của chuyến đã có trong cache (từ các trang đã xem), bỏ trùng; dùng để gợi ý giờ/phương tiện. */
export function cachedStops(qc: QueryClient, tripId: string): TripStop[] {
  const byId = new Map<string, TripStop>();
  for (const [, page] of qc.getQueriesData<StopsPage>({ queryKey: queryKeys.tripStopsAll(tripId) })) {
    for (const s of page?.items ?? []) byId.set(s.id, s);
  }
  return [...byId.values()];
}
