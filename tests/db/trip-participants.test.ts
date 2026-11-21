import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createSettleRepo } from '@/features/trips/repositories/settle-repo';
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

const partySize = async () => (await admin.from('trips').select('party_size').eq('id', T).single()).data!.party_size;

beforeAll(async () => {
  member = await signIn('settle');
  outsider = await signIn('settle-out');
  G = (await admin.from('groups').insert({ name: 'G-settle', created_by: member.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: member.id, role: 'owner' });
  T = (await createTripsRepo(member.db).createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(member.id);
  await admin.auth.admin.deleteUser(outsider.id);
});

describe('trip_participants', () => {
  test('thêm/bớt người thì số người chia của chuyến đi theo; trùng tên báo lỗi rõ', async () => {
    const repo = createSettleRepo(member.db);
    const a = await repo.add(T, 'Wibu');
    await repo.add(T, 'Sucvat');
    const c = await repo.add(T, 'An');
    expect(await partySize()).toBe(3);
    await expect(repo.add(T, ' wibu ')).rejects.toMatchObject({ code: 'DUPLICATE_PARTICIPANT' });
    await repo.remove(c.id);
    expect(await partySize()).toBe(2);
    expect((await repo.list(T)).map((p) => p.id)[0]).toBe(a.id);
  });

  test('chỉ một thủ quỹ; đổi thủ quỹ thì người cũ thôi', async () => {
    const repo = createSettleRepo(member.db);
    const [a, b] = await repo.list(T);
    await repo.setPayer(T, a.id);
    await repo.setPayer(T, b.id);
    const list = await repo.list(T);
    expect(list.filter((p) => p.is_payer).map((p) => p.id)).toEqual([b.id]);
  });

  test('lưu tài khoản thủ quỹ; số tài khoản sai định dạng bị DB từ chối', async () => {
    const repo = createSettleRepo(member.db);
    await repo.setPayerBank(T, { bin: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A' });
    const { data } = await admin.from('trips').select('payer_bank_bin, payer_account_no').eq('id', T).single();
    expect(data).toEqual({ payer_bank_bin: '970436', payer_account_no: '0123456789' });
    await expect(repo.setPayerBank(T, { bin: '970436', accountNo: '12 34', accountName: 'X' })).rejects.toBeTruthy();
  });

  test('người ngoài nhóm không thấy, không thêm được', async () => {
    const repo = createSettleRepo(outsider.db);
    expect(await repo.list(T)).toEqual([]);
    await expect(repo.add(T, 'Lạ')).rejects.toBeTruthy();
  });
});
