import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ACCOUNT_EMAIL_DOMAIN, normalizeUsername, USERNAME_PATTERN } from '@/features/auth/constants';
import { createAccountsRepo } from '@/features/auth/repositories/accounts-repo';
import type { Db } from '@/shared/supabase/db';
import type { Database } from '@/shared/supabase/database.types';

export type Role = 'owner' | 'member';
export interface AccountSpec {
  username: string;
  name?: string;
  /** Email của user có sẵn (ví dụ tài khoản Google cũ) để gắn username; bỏ trống thì tạo user mới với email giả. */
  email?: string;
}

/** Client service role từ `.env.local`/`.env` (Supabase local hoặc cloud). */
export function createScriptDb(): Db {
  for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function validUsername(raw: string): string {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) throw new Error(`Username "${raw}" không hợp lệ: 3–32 ký tự a-z, 0-9, dấu chấm, gạch dưới.`);
  return username;
}

async function findUserIdByEmail(db: Db, email: string): Promise<string | null> {
  // Auth admin không có tìm theo email; số user của app nhỏ nên duyệt từng trang.
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
  }
}

/** Đảm bảo có user mang username này; chạy lại chỉ cập nhật profile. Trả về user id. */
export async function ensureAccount(db: Db, spec: AccountSpec): Promise<string> {
  const username = validUsername(spec.username);
  const owner = await createAccountsRepo(db).findUserIdByUsername(username);
  const email = spec.email?.toLowerCase();
  const existing = email ? await findUserIdByEmail(db, email) : owner;
  if (owner && owner !== existing) throw new Error(`Username "${username}" đã thuộc tài khoản khác.`);

  if (existing) {
    const patch = spec.name ? { username, display_name: spec.name } : { username };
    const { error } = await db.from('profiles').update(patch).eq('id', existing);
    if (error) throw error;
    return existing;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: email ?? `${username}@${ACCOUNT_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: { username, display_name: spec.name ?? username },
  });
  if (error) throw error;
  return data.user.id;
}
