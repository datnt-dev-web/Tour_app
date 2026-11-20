import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/** Client cho Client Component. NEXT_PUBLIC_* phải tham chiếu tĩnh để Next inline vào bundle. */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
