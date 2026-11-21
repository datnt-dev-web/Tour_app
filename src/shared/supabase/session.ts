import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from './server';

/**
 * User của request hiện tại cho Server Component (chỉ cần id). Dùng getClaims: xác minh chữ ký JWT ngay tại server
 * (khóa ký bất đối xứng của Supabase), không tốn một lượt mạng tới Auth server mỗi lần render như getUser.
 * Bọc React.cache để layout và page trong cùng request chỉ xác minh một lần.
 */
export const getSessionUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { id } : null;
});
