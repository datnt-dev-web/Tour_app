import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { createPlacesRepo } from '../repositories/places-repo';
import { listBook } from '../services/book-service';

/** Toàn bộ sổ quán một lần; tìm và lọc chạy trên client với dữ liệu này. */
export const bookQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.book(groupId, {}),
    queryFn: () => listBook(createPlacesRepo(createBrowserSupabase()), groupId, {}),
  });

/** Tiền tố mọi cache sổ quán của nhóm, để invalidate mọi biến thể của danh sách. */
export const bookPrefix = (groupId: string) => ['book', groupId] as const;
