import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { createPlacesRepo } from '../repositories/places-repo';
import { listBook } from '../services/book-service';

/** Số chỗ hiện ở mục "Nhóm từng khen" trên trang chủ. */
export const PRAISED_LIMIT = 3;

/** Toàn bộ sổ quán một lần; tìm và lọc chạy trên client với dữ liệu này. */
export const bookQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.book(groupId, {}),
    queryFn: () => listBook(createPlacesRepo(createBrowserSupabase()), groupId, {}),
  });

export const praisedQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.book(groupId, { verdict: 'up' }),
    queryFn: async () => (await listBook(createPlacesRepo(createBrowserSupabase()), groupId, { verdict: 'up' })).slice(0, PRAISED_LIMIT),
  });

/** Tiền tố mọi cache sổ quán của nhóm, để invalidate cả danh sách đầy đủ lẫn mục "Nhóm từng khen". */
export const bookPrefix = (groupId: string) => ['book', groupId] as const;
