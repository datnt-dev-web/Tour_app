import { execSync } from 'node:child_process';

// Nếu chưa có biến môi trường, lấy URL/khóa của stack local từ `supabase status` (không hard-code khóa).
// Có thể ghi đè bằng DB_TEST_SUPABASE_URL / DB_TEST_ANON_KEY / DB_TEST_SERVICE_ROLE_KEY.
function loadLocalSupabase(): Record<string, string> {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const vars: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

if (!process.env.DB_TEST_SUPABASE_URL || !process.env.DB_TEST_ANON_KEY || !process.env.DB_TEST_SERVICE_ROLE_KEY) {
  const v = loadLocalSupabase();
  process.env.DB_TEST_SUPABASE_URL ??= v.API_URL;
  process.env.DB_TEST_ANON_KEY ??= v.ANON_KEY;
  process.env.DB_TEST_SERVICE_ROLE_KEY ??= v.SERVICE_ROLE_KEY;
}
