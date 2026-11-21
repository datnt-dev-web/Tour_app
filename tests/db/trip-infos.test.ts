import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createInfosRepo } from '@/features/info/repositories/infos-repo';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

let member: { id: string; db: SupabaseClient<Database> };
let outsider: { id: string; db: SupabaseClient<Database> };
let G: string;
let T: string;

async function signIn(tag: string) {
  const email = `${tag}-${run}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, anon, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

beforeAll(async () => {
  member = await signIn('infos');
  outsider = await signIn('infos-out');
  G = (await admin.from('groups').insert({ name: 'G-infos', created_by: member.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: member.id, role: 'owner' });
  T = (await createTripsRepo(member.db).createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(member.id);
  await admin.auth.admin.deleteUser(outsider.id);
});

describe('trip_infos', () => {
  test('thành viên thêm, liệt kê (mới nhất trước), đếm, xóa', async () => {
    const repo = createInfosRepo(member.db);
    await repo.insert({ trip_id: T, kind: 'note', title: 'SĐT', body: '0900' });
    const link = await repo.insert({ trip_id: T, kind: 'link', title: 'Sheet', url: 'https://x.test' });
    expect((await repo.list(T)).map((r) => r.id)[0]).toBe(link.id);
    expect(await repo.count(T)).toBe(2);
    expect((await repo.remove(link.id))?.id).toBe(link.id);
    expect(await repo.count(T)).toBe(1);
  });

  test('người ngoài nhóm không thấy, không thêm, không xóa được', async () => {
    const mine = await createInfosRepo(member.db).insert({ trip_id: T, kind: 'note', title: 'Bí mật', body: 'x' });
    const repo = createInfosRepo(outsider.db);
    expect(await repo.list(T)).toEqual([]);
    await expect(repo.insert({ trip_id: T, kind: 'note', title: 'Lạ', body: 'x' })).rejects.toBeTruthy();
    expect(await repo.remove(mine.id)).toBeNull();
  });

  test('ràng buộc theo loại: tệp phải có public id', async () => {
    await expect(createInfosRepo(member.db).insert({ trip_id: T, kind: 'file', title: 'Thiếu' })).rejects.toMatchObject({ code: '23514' });
  });
});
