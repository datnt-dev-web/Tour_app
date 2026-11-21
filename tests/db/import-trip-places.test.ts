import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTripsRepo, type ImportRpcRow } from '@/features/trips/repositories/trips-repo';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

let user: { id: string; db: SupabaseClient<Database> };
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

const newRow = (name: string, extra: Partial<ImportRpcRow> = {}): ImportRpcRow => ({
  place_id: null, name, category: 'food', address: null, maps_url: null, note: null, city_norm: 'hai phong', ...extra,
});

const countRows = async () => ({
  places: (await admin.from('places').select('id', { count: 'exact', head: true }).eq('group_id', G)).count,
  stops: (await admin.from('trip_places').select('id', { count: 'exact', head: true }).eq('trip_id', T)).count,
});

beforeAll(async () => {
  user = await signIn('import');
  outsider = await signIn('import-out');
  G = (await admin.from('groups').insert({ name: 'G-import', created_by: user.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: user.id, role: 'owner' });
  T = (await createTripsRepo(user.db).createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(user.id);
  await admin.auth.admin.deleteUser(outsider.id);
});

describe('import_trip_places', () => {
  test('dòng mới tạo chỗ và thêm vào chuyến với trạng thái wanted', async () => {
    const r = await createTripsRepo(user.db).importPlaces(T, [newRow('Bánh đa cua', { note: 'sáng', maps_url: 'https://m/x' }), newRow('Cafe Hạnh', { category: 'cafe' })]);
    expect(r).toEqual({ added: 2, skipped: 0 });
    const { data: stops } = await admin.from('trip_places').select('status, note, place_id').eq('trip_id', T);
    expect(stops).toHaveLength(2);
    expect(stops!.every((d) => d.status === 'wanted')).toBe(true);
    const { data: places } = await admin.from('places').select('id, name, category, city, maps_url, verified').eq('group_id', G);
    const banh = places!.find((p) => p.name === 'Bánh đa cua')!;
    expect(banh).toMatchObject({ category: 'food', city: 'Hải Phòng', maps_url: 'https://m/x', verified: false });
    expect(stops!.find((s) => s.place_id === banh.id)!.note).toBe('sáng');
  });

  test('nhập lại cùng chỗ (truyền place_id có sẵn) thì bỏ qua, không tạo trùng', async () => {
    const { data: places } = await admin.from('places').select('id, name').eq('group_id', G);
    const rows = places!.map((p) => newRow(p.name, { place_id: p.id }));
    const before = await countRows();
    expect(await createTripsRepo(user.db).importPlaces(T, rows)).toEqual({ added: 0, skipped: 2 });
    expect(await countRows()).toEqual(before);
  });

  test('người ngoài nhóm bị từ chối (42501), không ghi gì', async () => {
    const before = await countRows();
    await expect(createTripsRepo(outsider.db).importPlaces(T, [newRow('Lạ')])).rejects.toMatchObject({ code: '42501' });
    expect(await countRows()).toEqual(before);
  });

  test('một dòng hỏng thì cả lô rollback', async () => {
    const before = await countRows();
    const bad = newRow('Hỏng', { category: 'nope' as ImportRpcRow['category'] });
    await expect(createTripsRepo(user.db).importPlaces(T, [newRow('Tốt'), bad])).rejects.toBeTruthy();
    expect(await countRows()).toEqual(before);
  });
});
