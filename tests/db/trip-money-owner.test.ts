import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createSettleRepo } from '@/features/trips/repositories/settle-repo';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

let owner: { id: string; db: SupabaseClient<Database> };
let member: { id: string; db: SupabaseClient<Database> };
let G: string;
let T: string;
let TP: string;
let expenseId: string;
let payerId: string;

async function signIn(tag: string) {
  const email = `${tag}-${run}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, anon, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

const expenseRow = async () => (await admin.from('trip_expenses').select('label, amount, paid_by').eq('id', expenseId).single()).data!;
const placeRow = async () => (await admin.from('trip_places').select('cost, paid_by, status').eq('id', TP).single()).data!;

beforeAll(async () => {
  owner = await signIn('money-owner');
  member = await signIn('money-member');
  G = (await admin.from('groups').insert({ name: 'G-money', created_by: owner.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert([
    { group_id: G, user_id: owner.id, role: 'owner' },
    { group_id: G, user_id: member.id, role: 'member' },
  ]);
  T = (await createTripsRepo(owner.db).createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
  const place = (await admin.from('places').insert({ group_id: G, name: 'Bánh đa cua', city: 'Hải Phòng', city_norm: 'hai phong', category: 'food' }).select('id').single()).data!;
  TP = (await admin.from('trip_places').insert({ trip_id: T, place_id: place.id }).select('id').single()).data!.id;
  payerId = (await createSettleRepo(owner.db).add(T, 'Wibu')).id;
  expenseId = (await createTripsRepo(owner.db).addExpense(T, 'Vé tàu', 1_062_000)).id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(member.id);
});

describe('tiền của chuyến chỉ admin (owner nhóm) được ghi', () => {
  test('getTripInfo báo đúng ai sửa được tiền', async () => {
    expect((await createTripsRepo(owner.db).getTripInfo(T))?.canEditMoney).toBe(true);
    const info = await createTripsRepo(member.db).getTripInfo(T);
    expect(info?.canEditMoney).toBe(false);
    expect(info?.expenses.map((e) => e.label)).toEqual(['Vé tàu']);
  });

  test('admin sửa tên, số tiền, người trả của chi phí khác', async () => {
    await createTripsRepo(owner.db).updateExpense(expenseId, { label: 'Vé tàu khứ hồi', amount: 1_000_000, paidBy: payerId });
    expect(await expenseRow()).toEqual({ label: 'Vé tàu khứ hồi', amount: 1_000_000, paid_by: payerId });
  });

  test('thành viên không thêm/sửa/xóa được chi phí khác, dữ liệu giữ nguyên', async () => {
    const trips = createTripsRepo(member.db);
    await expect(trips.addExpense(T, 'Lén', 1)).rejects.toMatchObject({ code: '42501' });
    await expect(trips.updateExpense(expenseId, { amount: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(trips.removeExpense(expenseId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await expenseRow()).toEqual({ label: 'Vé tàu khứ hồi', amount: 1_000_000, paid_by: payerId });
  });

  test('admin đặt giá và người trả của một chỗ', async () => {
    await createTripsRepo(owner.db).updateTripPlace(TP, { cost: 140_000, paidBy: payerId });
    expect(await placeRow()).toMatchObject({ cost: 140_000, paid_by: payerId });
  });

  test('thành viên không đổi được giá/người trả, nhưng vẫn sửa giờ và trạng thái', async () => {
    const trips = createTripsRepo(member.db);
    await expect(trips.updateTripPlace(TP, { cost: 1 })).rejects.toMatchObject({ code: '42501' });
    await expect(trips.updateTripPlace(TP, { paidBy: null })).rejects.toMatchObject({ code: '42501' });
    // Gửi lại đúng giá cũ thì không bị chặn (không đổi tiền).
    await trips.updateTripPlace(TP, { schedule: { date: '2026-11-23', time: '08:00', endTime: null }, cost: 140_000 });
    await trips.setTripPlaceStatus(TP, 'confirmed');
    expect(await placeRow()).toEqual({ cost: 140_000, paid_by: payerId, status: 'confirmed' });
  });

  test('thành viên thêm chỗ mới có giá bị chặn, không giá thì được', async () => {
    const place = (await admin.from('places').insert({ group_id: G, name: 'Nem cua bể', city: 'Hải Phòng', city_norm: 'hai phong', category: 'food' }).select('id').single()).data!;
    expect((await member.db.from('trip_places').insert({ trip_id: T, place_id: place.id, cost: 1 })).error?.code).toBe('42501');
    expect((await member.db.from('trip_places').insert({ trip_id: T, place_id: place.id })).error).toBeNull();
  });
});

describe('sửa chỗ ở tab Danh sách: mọi thành viên đều được', () => {
  test('thành viên sửa tên, địa chỉ, loại, ghi chú trong một lần (cả places và trip_places)', async () => {
    await createTripsRepo(member.db).updateTripPlaceInfo(TP, { name: 'Bánh đa cua Bà Cụ', address: '179 Cầu Đất', category: 'snack', note: 'Gọi thêm chả lá lốt' });
    const tp = (await admin.from('trip_places').select('note, cost, place:places(name, address, category)').eq('id', TP).single()).data!;
    expect(tp).toEqual({ note: 'Gọi thêm chả lá lốt', cost: 140_000, place: { name: 'Bánh đa cua Bà Cụ', address: '179 Cầu Đất', category: 'snack' } });
  });

  test('để trống địa chỉ / ghi chú là bỏ; tên trống bị từ chối và không ghi gì', async () => {
    const trips = createTripsRepo(member.db);
    await trips.updateTripPlaceInfo(TP, { name: 'Bánh đa cua Bà Cụ', address: ' ', category: 'food', note: '' });
    const tp = (await admin.from('trip_places').select('note, place:places(address, category)').eq('id', TP).single()).data!;
    expect(tp).toEqual({ note: null, place: { address: null, category: 'food' } });
    await expect(trips.updateTripPlaceInfo(TP, { name: '  ', address: '', category: 'cafe', note: 'x' })).rejects.toBeTruthy();
    expect((await admin.from('trip_places').select('note').eq('id', TP).single()).data!.note).toBeNull();
  });

  test('người ngoài nhóm không sửa được (không tìm thấy)', async () => {
    const outsider = await signIn('money-out');
    await expect(createTripsRepo(outsider.db).updateTripPlaceInfo(TP, { name: 'Lạ', address: '', category: 'food', note: '' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await admin.auth.admin.deleteUser(outsider.id);
  });
});
