import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPhotosRepo } from '@/features/places/repositories/photos-repo';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.DB_TEST_SERVICE_ROLE_KEY!, opts);
const run = Date.now();
const users: string[] = [];
let member: SupabaseClient<Database>;
let outsider: SupabaseClient<Database>;
let G: string;
let P: string;

async function signIn(tag: string) {
  const email = `${tag}-${run}@example.test`;
  const id = (await admin.auth.admin.createUser({ email, password: 'Test-pass-12345', email_confirm: true })).data.user!.id;
  users.push(id);
  const db = createClient<Database>(url, anon, opts);
  await db.auth.signInWithPassword({ email, password: 'Test-pass-12345' });
  return { id, db };
}

beforeAll(async () => {
  const m = await signIn('photo');
  member = m.db;
  outsider = (await signIn('photo-out')).db;
  G = (await admin.from('groups').insert({ name: 'G-photo', created_by: m.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: m.id, role: 'owner' });
  P = (await createPlacesRepo(member).createLocalPlace({ groupId: G, userId: m.id, name: 'Quán ảnh', address: null, city: 'Hải Phòng', category: 'food' })).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe('place_photos', () => {
  test('thành viên thêm/xem/xóa ảnh trong thư mục của quán', async () => {
    const repo = createPhotosRepo(member);
    expect(await repo.placeExists(P)).toBe(true);
    const photo = await repo.insert({ place_id: P, trip_id: null, file_public_id: `food-tour/places/${P}/a`, file_format: 'jpg' });
    expect((await repo.list(P)).map((p) => p.id)).toEqual([photo.id]);
    expect((await repo.remove(photo.id))?.id).toBe(photo.id);
  });

  test('public id ngoài thư mục quán bị DB từ chối; người ngoài nhóm không thấy, không thêm được', async () => {
    await expect(createPhotosRepo(member).insert({ place_id: P, trip_id: null, file_public_id: 'food-tour/places/khac/a', file_format: 'jpg' })).rejects.toMatchObject({ code: '23514' });
    const repo = createPhotosRepo(outsider);
    expect(await repo.placeExists(P)).toBe(false);
    await expect(repo.insert({ place_id: P, trip_id: null, file_public_id: `food-tour/places/${P}/b`, file_format: 'jpg' })).rejects.toBeTruthy();
  });
});
