import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

async function makeUser(tag: string) {
  const email = `${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, anon, opts);
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: data.user.id, client };
}

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

let A: { id: string; client: SupabaseClient };
let B: { id: string; client: SupabaseClient };
let G: string;
let T: string;
let P: string;
let G2: string;
let T2: string;
let P2: string;

beforeAll(async () => {
  A = await makeUser('a');
  B = await makeUser('b');
  G = must(await admin.from('groups').insert({ name: 'G', created_by: A.id }).select('id').single()).id;
  must(await admin.from('group_members').insert({ group_id: G, user_id: A.id, role: 'owner' }));
  T = must(await admin.from('trips').insert({ group_id: G, name: 'T', city: 'Hải Phòng', created_by: A.id }).select('id').single()).id;
  P = must(
    await admin
      .from('places')
      .insert({ group_id: G, name: 'Quán', city: 'Hải Phòng', city_norm: 'hai phong', category: 'food', created_by: A.id })
      .select('id')
      .single(),
  ).id;
  must(await admin.from('trip_places').insert({ trip_id: T, place_id: P, added_by: A.id }).select('id').single());
  G2 = must(await admin.from('groups').insert({ name: 'G2', created_by: A.id }).select('id').single()).id;
  must(await admin.from('group_members').insert({ group_id: G2, user_id: A.id, role: 'owner' }));
  T2 = must(await admin.from('trips').insert({ group_id: G2, name: 'T2', city: 'x', created_by: A.id }).select('id').single()).id;
  P2 = must(
    await admin
      .from('places')
      .insert({ group_id: G2, name: 'P2', city: 'x', city_norm: 'x', category: 'food', created_by: A.id })
      .select('id')
      .single(),
  ).id;
  must(await admin.from('place_reviews_internal').insert({ place_id: P, user_id: A.id, trip_id: T, verdict: 'up' }));
  must(await admin.from('ai_cache').insert({ key: `k-${run}`, value: { x: 1 }, expires_at: new Date(Date.now() + 1e6).toISOString() }));
});

afterAll(async () => {
  await admin.from('groups').delete().in('id', [G, G2]);
  await admin.auth.admin.deleteUser(A.id);
  await admin.auth.admin.deleteUser(B.id);
});

describe('RLS', () => {
  test('trigger tạo profile khi có user mới', async () => {
    expect((await admin.from('profiles').select().eq('id', A.id)).data).toHaveLength(1);
  });

  test('thành viên đọc được trip', async () => {
    expect((await A.client.from('trips').select().eq('id', T)).data).toHaveLength(1);
  });

  test('thành viên đọc được places/trip_places/reviews', async () => {
    expect((await A.client.from('places').select().eq('group_id', G)).data).toHaveLength(1);
    expect((await A.client.from('trip_places').select().eq('trip_id', T)).data).toHaveLength(1);
    expect((await A.client.from('place_reviews_internal').select().eq('place_id', P)).data).toHaveLength(1);
  });

  test('người ngoài không đọc được trip/places/trip_places', async () => {
    for (const t of ['trips', 'places', 'trip_places', 'place_reviews_internal', 'groups', 'group_members']) {
      expect((await B.client.from(t).select()).data).toEqual([]);
    }
  });

  test('người ngoài không chèn được place vào nhóm G', async () => {
    const r = await B.client.from('places').insert({ group_id: G, name: 'x', city: 'x', city_norm: 'x', category: 'food' });
    expect(r.error).not.toBeNull();
  });

  test('người ngoài không chèn được trip_places vào trip của G', async () => {
    const r = await B.client.from('trip_places').insert({ trip_id: T, place_id: P, added_by: B.id });
    expect(r.error).not.toBeNull();
  });

  test('thành viên chèn được place vào nhóm của mình', async () => {
    const r = await A.client
      .from('places')
      .insert({ group_id: G, name: 'ok', city: 'x', city_norm: 'x', category: 'cafe', created_by: A.id });
    expect(r.error).toBeNull();
  });

  test('trùng google_place_id trong một nhóm bị chặn', async () => {
    const row = { group_id: G, google_place_id: 'gp1', name: 'x', city: 'x', city_norm: 'x', category: 'food' as const };
    expect((await admin.from('places').insert(row)).error).toBeNull();
    expect((await admin.from('places').insert(row)).error?.code).toBe('23505');
  });

  test('chi phí khác (trip_expenses): thành viên ghi/đọc được, người ngoài thì không', async () => {
    const mine = await A.client.from('trip_expenses').insert({ trip_id: T, label: 'Vé tàu', amount: 1062000 }).select('id, created_by').single();
    expect(mine.error).toBeNull();
    expect(mine.data?.created_by).toBe(A.id);
    expect((await B.client.from('trip_expenses').select().eq('trip_id', T)).data).toEqual([]);
    expect((await B.client.from('trip_expenses').insert({ trip_id: T, label: 'x', amount: 1 })).error).not.toBeNull();
    const del = await B.client.from('trip_expenses').delete().eq('id', mine.data!.id).select('id');
    expect(del.data ?? []).toEqual([]);
    expect((await A.client.from('trip_expenses').insert({ trip_id: T, label: 'âm', amount: -1 })).error).not.toBeNull();
  });

  test('cost và party_size: không nhận số âm / số người 0', async () => {
    expect((await A.client.from('trip_places').update({ cost: -1 }).eq('trip_id', T)).error).not.toBeNull();
    expect((await A.client.from('trips').update({ party_size: 0 }).eq('id', T)).error).not.toBeNull();
    expect((await A.client.from('trip_places').update({ cost: 120000 }).eq('trip_id', T)).error).toBeNull();
  });

  test('giờ kết thúc: phải có giờ bắt đầu và sau giờ bắt đầu', async () => {
    const tp = (patch: Record<string, unknown>) => A.client.from('trip_places').update(patch).eq('trip_id', T);
    expect((await tp({ visit_date: '2026-11-23', visit_time: '09:30', visit_end_time: '09:00' })).error).not.toBeNull();
    expect((await tp({ visit_date: null, visit_time: null, visit_end_time: '09:00' })).error).not.toBeNull();
    expect((await tp({ visit_date: '2026-11-23', visit_time: '08:45', visit_end_time: '09:30', transport: 'Xe máy thuê' })).error).toBeNull();
    expect((await tp({ transport: '   ' })).error).not.toBeNull();
  });

  test('ai_cache chỉ service role truy cập', async () => {
    expect((await A.client.from('ai_cache').select()).data ?? []).toEqual([]);
    expect((await A.client.from('ai_cache').insert({ key: 'z', value: {}, expires_at: new Date().toISOString() })).error).not.toBeNull();
    expect((await admin.from('ai_cache').select().eq('key', `k-${run}`)).data).toHaveLength(1);
  });

  test('is_group_member phản ánh đúng thành viên', async () => {
    expect((await A.client.rpc('is_group_member', { gid: G })).data).toBe(true);
    expect((await B.client.rpc('is_group_member', { gid: G })).data).toBe(false);
  });

  test('người dùng không tự thêm mình vào nhóm', async () => {
    const r = await B.client.from('group_members').insert({ group_id: G, user_id: B.id, role: 'member' });
    expect(r.error).not.toBeNull();
  });

  test('không chuyển được review sang place của nhóm khác (A chỉ ở G, không ở H)', async () => {
    const H = must(await admin.from('groups').insert({ name: 'H', created_by: B.id }).select('id').single()).id;
    const PH = must(
      await admin
        .from('places')
        .insert({ group_id: H, name: 'h', city: 'x', city_norm: 'x', category: 'food' })
        .select('id')
        .single(),
    ).id;
    const r = await A.client.from('place_reviews_internal').update({ place_id: PH }).eq('place_id', P).select();
    expect(r.error).not.toBeNull();
    await admin.from('groups').delete().eq('id', H);
  });

  test('không chèn review với trip_id của nhóm khác', async () => {
    const r = await A.client.from('place_reviews_internal').insert({ place_id: P, trip_id: T2, verdict: 'up' });
    expect(r.error).not.toBeNull();
  });

  test('không đổi trip_id review sang trip nhóm khác', async () => {
    const r = await A.client.from('place_reviews_internal').update({ trip_id: T2 }).eq('place_id', P).select();
    expect(r.error).not.toBeNull();
  });

  test('group_id của trips và places bất biến', async () => {
    expect((await A.client.from('trips').update({ group_id: G2 }).eq('id', T).select()).error).not.toBeNull();
    expect((await A.client.from('places').update({ group_id: G2 }).eq('id', P).select()).error).not.toBeNull();
    expect(P2).toBeDefined();
  });
});
