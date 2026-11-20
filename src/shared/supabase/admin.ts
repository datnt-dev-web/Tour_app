import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/config/env';
import type { Database } from './database.types';

/**
 * Client service role, BỎ QUA RLS. Chỉ dùng cho seed, ai_cache và kiểm tra lời mời;
 * không bao giờ import từ code chạy ở trình duyệt.
 */
export function createAdminSupabase() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
