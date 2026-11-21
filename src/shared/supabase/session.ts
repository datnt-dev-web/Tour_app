import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from './server';

/**
 * User của request hiện tại cho Server Component. Bọc React.cache để layout và page (render song song trong
 * cùng request) chỉ gọi Supabase Auth một lần thay vì mỗi nơi một lượt mạng.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
