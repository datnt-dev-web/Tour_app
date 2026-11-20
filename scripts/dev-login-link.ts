/**
 * Chỉ cho Supabase LOCAL: `npm run dev:login-link -- --email you@example.com [--origin http://localhost:3000]`.
 * Đảm bảo user tồn tại, có nhóm (tạo "Hội ăn chơi" nếu chưa), nhóm chưa có chuyến thì seed Hải Phòng (không gọi Places),
 * rồi in URL đăng nhập một lần trỏ vào /auth/callback?token_hash=...
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import data from './data/haiphong-2026-11.json';
import { BOOTSTRAP_GROUP_NAME } from '@/features/auth/services/access-service';
import { createInvitesRepo } from '@/features/groups/repositories/invites-repo';
import { createSeedDeps, seedTrip, type SeedTrip } from '@/features/places/services/seed-service';
import type { Database } from '@/shared/supabase/database.types';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);

const { values } = parseArgs({ options: { email: { type: 'string' }, origin: { type: 'string', default: 'http://localhost:3000' } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!values.email) throw new Error('Dùng: npm run dev:login-link -- --email <email>');
if (!url || !serviceKey) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error(`Từ chối chạy: ${url} không phải Supabase local.`);

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = values.email.toLowerCase();

async function main() {
  // generateLink magiclink tự tạo user chưa có, nên lấy user id từ kết quả.
  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !link.user) throw error ?? new Error('generateLink không trả user.');
  const userId = link.user.id;

  const repo = createInvitesRepo(db);
  let groupId: string;
  if (await repo.hasAnyGroup(userId)) {
    const { data: m, error: e } = await db.from('group_members').select('group_id').eq('user_id', userId).limit(1).single();
    if (e) throw e;
    groupId = m.group_id;
  } else {
    groupId = await repo.createGroupWithOwner(BOOTSTRAP_GROUP_NAME, userId);
  }

  const { count, error: ce } = await db.from('trips').select('id', { count: 'exact', head: true }).eq('group_id', groupId);
  if (ce) throw ce;
  if (!count) {
    const r = await seedTrip(createSeedDeps(db, null), { groupId, userId, data: data as SeedTrip });
    console.error(`Đã seed Hải Phòng: ${r.created} chỗ mới.`);
  }

  console.log(`${values.origin}/auth/callback?token_hash=${link.properties.hashed_token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
