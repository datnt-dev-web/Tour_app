import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { createGroupsRepo } from '@/features/groups/repositories/groups-repo';
import { createTripsRepo } from '@/features/trips/repositories/trips-repo';
import { getCurrentGroup } from '@/features/groups/services/groups-service';
import { runAction } from '@/shared/actions';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';
const NO_ID = '00000000-0000-0000-0000-000000000000';

let user: { id: string; db: SupabaseClient<Database> };
let G: string;
let G2: string;
let GX: string; // nhóm user không thuộc về

const candidate = (id: string) => ({
  googlePlaceId: id, name: `Quán ${id}`, address: 'Số 1', rating: 4.5, reviewCount: 100, priceTier: 1 as const, openNow: null, mapsUrl: 'https://maps.example/x',
});

beforeAll(async () => {
  const email = `trips-${run}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, anon, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  user = { id: created.data.user.id, db };
  const g1 = await admin.from('groups').insert({ name: 'Nhóm cũ', created_by: user.id, created_at: '2026-01-01T00:00:00Z' }).select('id').single();
  const g2 = await admin.from('groups').insert({ name: 'Nhóm mới', created_by: user.id, created_at: '2026-06-01T00:00:00Z' }).select('id').single();
  G = g1.data!.id;
  G2 = g2.data!.id;
  GX = (await admin.from('groups').insert({ name: 'Ngoài', created_by: user.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert([
    { group_id: G, user_id: user.id, role: 'owner' },
    { group_id: G2, user_id: user.id, role: 'owner' },
  ]);
});

afterAll(async () => {
  await admin.from('groups').delete().in('id', [G, G2, GX]);
  await admin.auth.admin.deleteUser(user.id);
});

describe('groups', () => {
  test('getCurrentGroup lấy nhóm mới nhất, cookie chọn nhóm khác, cookie lạ bị bỏ qua', async () => {
    const repo = createGroupsRepo(user.db);
    expect((await getCurrentGroup(repo, user.id)).id).toBe(G2);
    expect((await getCurrentGroup(repo, user.id, G)).id).toBe(G);
    expect((await getCurrentGroup(repo, user.id, NO_ID)).id).toBe(G2);
  });
  test('không thuộc nhóm nào: NO_GROUP', async () => {
    await expect(getCurrentGroup(createGroupsRepo(user.db), NO_ID)).rejects.toMatchObject({ code: 'NO_GROUP' });
  });
});

describe('places + trips repo', () => {
  test('upsertPlaceFromGoogle cùng google_place_id trả cùng place.id', async () => {
    const places = createPlacesRepo(user.db);
    const a = await places.upsertPlaceFromGoogle(G, candidate('gp-same'), 'food', 'Hải Phòng', user.id);
    const b = await places.upsertPlaceFromGoogle(G, candidate('gp-same'), 'cafe', 'Hải Phòng', user.id);
    expect(b.id).toBe(a.id);
    expect(a.city_norm).toBe('hai phong');
    expect(a.created_by).toBe(user.id);
  });

  test('thêm cùng chỗ 2 lần không nhân đôi, giữ status confirmed', async () => {
    const places = createPlacesRepo(user.db);
    const trips = createTripsRepo(user.db);
    const trip = await trips.createTrip({ groupId: G, name: 'T1', city: 'Hải Phòng', startDate: '2026-12-01', endDate: '2026-12-03' });
    const place = await places.upsertPlaceFromGoogle(G, candidate('gp-dup'), 'food', 'Hải Phòng', user.id);
    const first = await trips.addPlaceToTrip(trip.id, place.id, user.id);
    await trips.setTripPlaceStatus(first.id, 'confirmed');
    const second = await trips.addPlaceToTrip(trip.id, place.id, user.id);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('confirmed');
    const detail = await trips.getTripDetail(trip.id);
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items[0]).toMatchObject({ status: 'confirmed', place: { name: 'Quán gp-dup' } });
  });

  test('listTrips trả TripSummary đếm confirmed và pending (wanted)', async () => {
    const places = createPlacesRepo(user.db);
    const trips = createTripsRepo(user.db);
    const trip = await trips.createTrip({ groupId: G2, name: 'T-count', city: 'Hà Nội', startDate: '2026-12-10', endDate: '2026-12-12' });
    const ids: string[] = [];
    for (const g of ['c1', 'c2', 'c3', 'c4']) {
      const p = await places.upsertPlaceFromGoogle(G2, candidate(`gp-${g}`), 'food', 'Hà Nội', user.id);
      ids.push((await trips.addPlaceToTrip(trip.id, p.id, user.id)).id);
    }
    await trips.setTripPlaceStatus(ids[0], 'confirmed');
    await trips.setTripPlaceStatus(ids[1], 'confirmed');
    await trips.setTripPlaceStatus(ids[2], 'dropped');
    const found = (await trips.listTrips(G2)).find((t) => t.id === trip.id);
    expect(found).toMatchObject({ confirmedCount: 2, pendingCount: 1 });
  });

  test('removeFromTrip xóa dòng; getTrip chuyến lạ trả null', async () => {
    const places = createPlacesRepo(user.db);
    const trips = createTripsRepo(user.db);
    const trip = await trips.createTrip({ groupId: G, name: 'T-rm', city: 'x', startDate: '2026-12-01', endDate: '2026-12-02' });
    const p = await places.upsertPlaceFromGoogle(G, candidate('gp-rm'), 'snack', 'x', user.id);
    const tp = await trips.addPlaceToTrip(trip.id, p.id, user.id, 'ghi chú');
    expect(tp.note).toBe('ghi chú');
    await trips.removeFromTrip(tp.id);
    expect((await trips.getTripDetail(trip.id))?.items).toHaveLength(0);
    expect(await trips.getTrip(NO_ID)).toBeNull();
  });

  test('thêm lại chỗ đã dropped đưa về wanted; status khác giữ nguyên', async () => {
    const places = createPlacesRepo(user.db);
    const trips = createTripsRepo(user.db);
    const trip = await trips.createTrip({ groupId: G, name: 'T-revive', city: 'x', startDate: '2026-12-01', endDate: '2026-12-02' });
    const p = await places.upsertPlaceFromGoogle(G, candidate('gp-revive'), 'food', 'x', user.id);
    const tp = await trips.addPlaceToTrip(trip.id, p.id, user.id);
    await trips.setTripPlaceStatus(tp.id, 'dropped');
    expect((await trips.addPlaceToTrip(trip.id, p.id, user.id)).status).toBe('wanted');
    await trips.setTripPlaceStatus(tp.id, 'visited');
    expect((await trips.addPlaceToTrip(trip.id, p.id, user.id)).status).toBe('visited');
  });

  test('setTripPlaceStatus/removeFromTrip trên dòng không tồn tại: NOT_FOUND', async () => {
    const trips = createTripsRepo(user.db);
    await expect(trips.setTripPlaceStatus(NO_ID, 'confirmed')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(trips.removeFromTrip(NO_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('runAction: tạo chuyến vào nhóm lạ trả FORBIDDEN, không ném lỗi Postgres', async () => {
    const trips = createTripsRepo(user.db);
    const r = await runAction(() => trips.createTrip({ groupId: GX, name: 'x', city: 'x', startDate: '2026-12-01', endDate: '2026-12-02' }));
    expect(r).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'Bạn không có quyền với dữ liệu này.' } });
  });
});
