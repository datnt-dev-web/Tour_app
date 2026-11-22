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

  test('tài khoản nhận tiền theo từng người; sai định dạng bị từ chối; bỏ được', async () => {
    const repo = createSettleRepo(member.db);
    const [a] = await repo.list(T);
    await repo.setBank(a.id, { bin: '970436', accountNo: '0123456789', accountName: 'NGUYEN VAN A' });
    expect((await repo.list(T))[0]).toMatchObject({ bank_bin: '970436', account_no: '0123456789', account_name: 'NGUYEN VAN A' });
    await expect(repo.setBank(a.id, { bin: '970436', accountNo: '12 34', accountName: 'X' })).rejects.toBeTruthy();
    await repo.setBank(a.id, null);
    expect((await repo.list(T))[0]).toMatchObject({ bank_bin: null, account_no: null, account_name: null });
  });

  test('ghi người trả và lần chuyển; người của chuyến khác bị từ chối; không xóa được người còn dính tới tiền', async () => {
    const settle = createSettleRepo(member.db);
    const trips = createTripsRepo(member.db);
    const [a, b] = await settle.list(T);
    const other = await trips.createTrip({ groupId: G, name: 'DL', city: 'Đà Lạt', startDate: '2026-12-01', endDate: '2026-12-02' });
    const stranger = await settle.add(other.id, 'Lạ');

    const expense = await trips.addExpense(T, 'Khách sạn', 900_001, a.id);
    await expect(trips.addExpense(T, 'Sai', 1_000, stranger.id)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(trips.setExpensePayer(expense.id, stranger.id)).rejects.toMatchObject({ code: 'VALIDATION' });

    await settle.addTransfer({ tripId: T, fromId: b.id, toId: a.id, amount: 200_000 });
    await expect(settle.addTransfer({ tripId: T, fromId: stranger.id, toId: a.id, amount: 1 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(settle.addTransfer({ tripId: T, fromId: a.id, toId: a.id, amount: 1 })).rejects.toBeTruthy();
    await expect(settle.addTransfer({ tripId: T, fromId: b.id, toId: a.id, amount: 0 })).rejects.toBeTruthy();

    const data = await settle.splitData(T);
    expect(data.items).toEqual([{ id: expense.id, label: 'Khách sạn', amount: 900_001, paidBy: a.id }]);
    expect(data.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([[b.id, a.id, 200_000]]);

    await expect(settle.remove(a.id)).rejects.toMatchObject({ code: 'PARTICIPANT_IN_USE' });
    await expect(settle.remove(b.id)).rejects.toMatchObject({ code: 'PARTICIPANT_IN_USE' });

    // Xóa cả chuyến thì người, khoản chi, lần chuyển cùng bị xóa (khóa ngoại không chặn).
    await settle.add(other.id, 'Quen');
    const [x, y] = await settle.list(other.id);
    await trips.addExpense(other.id, 'Xe', 100_000, x.id);
    await settle.addTransfer({ tripId: other.id, fromId: y.id, toId: x.id, amount: 50_000 });
    const del = await member.db.from('trips').delete().eq('id', other.id).select('id');
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });

  test('người ngoài nhóm không thấy, không thêm được', async () => {
    const repo = createSettleRepo(outsider.db);
    expect(await repo.list(T)).toEqual([]);
    await expect(repo.add(T, 'Lạ')).rejects.toBeTruthy();
    const data = await repo.splitData(T);
    expect([data.participants, data.items, data.transfers]).toEqual([[], [], []]);
    const [a, b] = await createSettleRepo(member.db).list(T);
    await expect(repo.addTransfer({ tripId: T, fromId: b.id, toId: a.id, amount: 1_000 })).rejects.toBeTruthy();
  });
});
