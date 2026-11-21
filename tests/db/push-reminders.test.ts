import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createPushRepo } from '@/features/push/repositories/push-repo';
import type { Database } from '@/shared/supabase/database.types';

const admin = createClient<Database>(process.env.DB_TEST_SUPABASE_URL!, process.env.DB_TEST_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repo = createPushRepo(admin);
let userId: string;
let groupId: string;
let tripId: string;

/** Ngày + giờ địa phương Việt Nam của (bây giờ + phút), dạng cột visit_date / visit_time. */
function vnSlot(addMin: number): { visit_date: string; visit_time: string } {
  const d = new Date(Date.now() + addMin * 60_000 + 7 * 3600_000);
  return { visit_date: d.toISOString().slice(0, 10), visit_time: d.toISOString().slice(11, 16) };
}

async function addStop(name: string, addMin: number, status: 'wanted' | 'confirmed' | 'visited' | 'dropped' = 'confirmed') {
  const place = (await admin.from('places').insert({ group_id: groupId, name, city: 'Hải Phòng', city_norm: 'hai phong', category: 'food', verified: false }).select('id').single()).data!;
  return (await admin.from('trip_places').insert({ trip_id: tripId, place_id: place.id, status, ...vnSlot(addMin) }).select('id').single()).data!.id;
}

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({ email: `push-${Date.now()}@example.test`, password: 'Test-pass-12345', email_confirm: true });
  if (u.error) throw u.error;
  userId = u.data.user.id;
  groupId = (await admin.from('groups').insert({ name: 'Nhóm push', created_by: userId }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'owner' });
  tripId = (await admin.from('trips').insert({ group_id: groupId, name: 'Chuyến push', city: 'Hải Phòng' }).select('id').single()).data!.id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', groupId);
  await admin.auth.admin.deleteUser(userId);
});

test('chỉ lấy chỗ sắp tới giờ (giờ Việt Nam) còn đi; claim xong thì không nhắc lại; đổi giờ thì nhắc theo giờ mới', async () => {
  const soon = await addStop('Sắp tới', 10);
  const far = await addStop('Còn xa', 90);
  const past = await addStop('Đã qua', -10);
  const dropped = await addStop('Đã bỏ', 10, 'dropped');

  const due = (await repo.dueReminders(30)).filter((d) => [soon, far, past, dropped].includes(d.tripPlaceId));
  expect(due.map((d) => d.tripPlaceId)).toEqual([soon]);
  expect(due[0]).toMatchObject({ tripId, groupId, placeName: 'Sắp tới', tripName: 'Chuyến push' });

  expect(await repo.claim(due)).toEqual(new Set([soon]));
  expect(await repo.claim(due)).toEqual(new Set());
  expect((await repo.dueReminders(30)).some((d) => d.tripPlaceId === soon)).toBe(false);

  await admin.from('trip_places').update(vnSlot(20)).eq('id', soon);
  expect((await repo.dueReminders(30)).some((d) => d.tripPlaceId === soon)).toBe(true);
});

test('đăng ký của thành viên nhóm được lấy theo nhóm; lưu lại cùng endpoint thì đè chứ không nhân đôi', async () => {
  const endpoint = `https://push.example.test/${Date.now()}`;
  await repo.saveSubscription(userId, { endpoint, p256dh: 'k1', auth: 'a1' });
  await repo.saveSubscription(userId, { endpoint, p256dh: 'k2', auth: 'a2' });
  const targets = (await repo.targetsForGroups([groupId])).filter((t) => t.endpoint === endpoint);
  expect(targets).toEqual([{ groupId, endpoint, p256dh: 'k2', auth: 'a2' }]);
  await repo.removeEndpoints([endpoint]);
  expect((await repo.targetsForGroups([groupId])).some((t) => t.endpoint === endpoint)).toBe(false);
});
