import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPlacesRepo, type StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { createTripsRepo, STOPS_PAGE_SIZE, type StopsQuery } from '@/features/trips/repositories/trips-repo';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

let user: { id: string; db: SupabaseClient<Database> };
let outsider: SupabaseClient<Database>;
let G: string;
let T: string;
const ids: Record<string, string> = {};

async function signIn(tag: string) {
  const email = `${tag}-${run}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, anon, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

// Dựng theo bảng kế hoạch Hải Phòng: ngày 23 có các khung giờ, một chỗ chồng giờ, một chỗ chưa xếp giờ, một chỗ đã bỏ.
const STOPS: { key: string; category: StoredPlaceCategory; date?: string; time?: string; end?: string; cost?: number; status?: 'visited' | 'dropped' | 'wanted' }[] = [
  { key: 'banhda', category: 'food', date: '2026-11-23', time: '08:45', end: '09:30', status: 'visited' },
  { key: 'cafe', category: 'cafe', date: '2026-11-23', time: '09:45', end: '10:30', cost: 100000, status: 'visited' },
  { key: 'nhahat', category: 'play', date: '2026-11-23', time: '10:30', end: '11:30' },
  { key: 'checkin', category: 'stay', date: '2026-11-23', time: '13:30', end: '15:15' },
  { key: 'banhduc', category: 'snack', date: '2026-11-23', time: '15:00', end: '17:00', cost: 60000 },
  { key: 'bunca', category: 'food', date: '2026-11-24', time: '07:00', end: '08:15', cost: 160000 },
  { key: 'suidin', category: 'snack', status: 'wanted' },
  { key: 'bo', category: 'food', date: '2026-11-23', time: '09:00', cost: 999999, status: 'dropped' },
];

beforeAll(async () => {
  user = await signIn('stops');
  outsider = (await signIn('stops-out')).db;
  G = (await admin.from('groups').insert({ name: 'G-stops', created_by: user.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: user.id, role: 'owner' });
  const trips = createTripsRepo(user.db);
  const places = createPlacesRepo(user.db);
  T = (await trips.createTrip({ groupId: G, name: 'HP', city: 'Hải Phòng', startDate: '2026-11-23', endDate: '2026-11-24' })).id;
  await trips.setPartySize(T, 4);
  for (const s of STOPS) {
    const p = await places.createLocalPlace({ groupId: G, userId: user.id, name: s.key, address: null, city: 'Hải Phòng', category: s.category });
    const tp = await trips.addPlaceToTrip(T, p.id, user.id);
    ids[s.key] = tp.id;
    await trips.updateTripPlace(tp.id, {
      ...(s.date && { schedule: { date: s.date, time: s.time!, endTime: s.end ?? null } }),
      ...(s.cost !== undefined && { cost: s.cost }),
    });
    await trips.setTripPlaceStatus(tp.id, s.status ?? 'confirmed');
  }
  await trips.addExpense(T, 'Vé tàu', 1062000);
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', G);
  await admin.auth.admin.deleteUser(user.id);
});

const ALL: StopsQuery = { order: 'schedule', statuses: ['wanted', 'confirmed', 'visited'], day: 'all', page: 1 };
const names = (items: { place: { name: string } }[]) => items.map((i) => i.place.name);

describe('listStops (view trip_stops)', () => {
  test('timeline: theo ngày rồi giờ, chưa xếp giờ cuối, bỏ chỗ đã "Bỏ", kèm place', async () => {
    const r = await createTripsRepo(user.db).listStops(T, ALL);
    expect(r.total).toBe(7);
    expect(names(r.items)).toEqual(['banhda', 'cafe', 'nhahat', 'checkin', 'banhduc', 'bunca', 'suidin']);
  });

  test('lọc ngày, chưa xếp giờ, trạng thái', async () => {
    const repo = createTripsRepo(user.db);
    expect(names((await repo.listStops(T, { ...ALL, day: '2026-11-24' })).items)).toEqual(['bunca']);
    expect(names((await repo.listStops(T, { ...ALL, day: 'none' })).items)).toEqual(['suidin']);
    expect(names((await repo.listStops(T, { ...ALL, statuses: ['visited'] })).items)).toEqual(['banhda', 'cafe']);
  });

  test('danh sách: gom theo loại (thứ tự enum), trong loại theo lịch', async () => {
    const r = await createTripsRepo(user.db).listStops(T, { ...ALL, order: 'category' });
    expect(r.items.map((i) => i.category)).toEqual(['food', 'food', 'snack', 'snack', 'cafe', 'play', 'stay']);
    expect(names(r.items).slice(0, 2)).toEqual(['banhda', 'bunca']);
  });

  test('trùng giờ tính trên cả ngày: check-in 13:30–15:15 chồng bánh đúc 15:00; nối tiếp đúng giờ thì không; chỗ đã bỏ không tính', async () => {
    const r = await createTripsRepo(user.db).listStops(T, ALL);
    const clash = Object.fromEntries(r.items.map((i) => [i.place.name, i.clash]));
    expect(clash).toMatchObject({ banhda: false, cafe: false, nhahat: false, checkin: true, banhduc: true, bunca: false, suidin: false });
  });

  test('phân trang: trang ngoài tầm trả rỗng nhưng vẫn có tổng', async () => {
    const r = await createTripsRepo(user.db).listStops(T, { ...ALL, page: 2 });
    expect(r.items).toHaveLength(Math.max(0, 7 - STOPS_PAGE_SIZE));
    expect(r.total).toBe(7);
  });

  test('người ngoài nhóm không thấy gì', async () => {
    const r = await createTripsRepo(outsider).listStops(T, ALL);
    expect(r).toEqual({ items: [], total: 0 });
    expect(await createTripsRepo(outsider).getTripStats(T)).toBeNull();
  });
});

describe('getTripStats (hàm trip_stats)', () => {
  test('tổng, theo loại, theo ngày, tiến độ; chỗ đã bỏ không tính', async () => {
    const s = await createTripsRepo(user.db).getTripStats(T);
    expect(s).toEqual({
      people: 4,
      placesTotal: 320000,
      expensesTotal: 1062000,
      visitedTotal: 100000,
      priced: 3,
      active: 7,
      visited: 2,
      confirmed: 4,
      wanted: 1,
      byCategory: [
        { category: 'food', total: 160000, count: 1 },
        { category: 'snack', total: 60000, count: 1 },
        { category: 'cafe', total: 100000, count: 1 },
      ],
      byDay: [
        { date: '2026-11-23', total: 160000 },
        { date: '2026-11-24', total: 160000 },
      ],
    });
  });

  test('getTripInfo trả chuyến kèm chi phí khác', async () => {
    const info = await createTripsRepo(user.db).getTripInfo(T);
    expect(info?.trip.party_size).toBe(4);
    expect(info?.expenses.map((e) => [e.label, e.amount])).toEqual([['Vé tàu', 1062000]]);
  });
});
