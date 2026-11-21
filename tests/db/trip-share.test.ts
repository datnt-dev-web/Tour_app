import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { generateShareToken } from '@/features/trips/services/share';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anonKey = process.env.DB_TEST_ANON_KEY!;
const admin = createClient(url, process.env.DB_TEST_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now();
let userId: string;
let G: string;
let T: string;

beforeAll(async () => {
  const email = `share-${run}@example.test`;
  userId = (await admin.auth.admin.createUser({ email, password: 'Test-pass-12345', email_confirm: true })).data.user!.id;
  const db = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithPassword({ email, password: 'Test-pass-12345' });
  G = (await admin.from('groups').insert({ name: 'G-share', created_by: userId }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: userId, role: 'owner' });
  T = (await createTripsRepo(db).createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(userId);
});

describe('trips share link', () => {
  test('token phải đúng định dạng và đi kèm hạn dùng', async () => {
    expect((await admin.from('trips').update({ share_token: 'ngan', share_expires_at: new Date().toISOString() }).eq('id', T)).error?.code).toBe('23514');
    expect((await admin.from('trips').update({ share_token: generateShareToken(), share_expires_at: null }).eq('id', T)).error?.code).toBe('23514');
    expect((await admin.from('trips').update({ share_token: generateShareToken(), share_expires_at: new Date().toISOString() }).eq('id', T)).error).toBeNull();
  });

  test('người chưa đăng nhập không đọc được chuyến qua API dù biết token', async () => {
    const token = (await admin.from('trips').select('share_token').eq('id', T).single()).data!.share_token!;
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await anon.from('trips').select('id').eq('share_token', token)).data ?? []).toEqual([]);
  });
});
