import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/** Client Supabase có kiểu; repo nhận client theo phiên người dùng (server hoặc browser) để RLS luôn áp dụng. */
export type Db = SupabaseClient<Database>;
