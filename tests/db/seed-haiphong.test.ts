import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, test } from 'vitest';
import data from '../../scripts/data/haiphong-2026-11.json';
import { createSeedDeps, seedTrip, type SeedTrip } from '@/features/places/services/seed-service';
import type { Database } from '@/shared/supabase/database.types';

const admin = createClient<Database>(process.env.DB_TEST_SUPABASE_URL!, process.env.DB_TEST_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let userId: string;
let groupId: string;

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({ email: `seed-${Date.now()}@example.test`, password: 'Test-pass-12345', email_confirm: true });
  if (u.error) throw u.error;
  userId = u.data.user.id;
  groupId = (await admin.from('groups').insert({ name: 'Nhóm seed', created_by: userId }).select('id').single()).data!.id;
});

afterAll(async () => {
  await admin.from('groups').delete().eq('id', groupId);
  await admin.auth.admin.deleteUser(userId);
});

async function counts() {
  const c = async (t: 'places' | 'trips' | 'trip_places' | 'place_reviews_internal') =>
    (await admin.from(t).select('*', { count: 'exact', head: true })).count;
  return [await c('places'), await c('trips'), await c('trip_places'), await c('place_reviews_internal')];
}

test('seed Hải Phòng 2 lần: 17 chỗ, 14 trip_places, không nhân đôi', async () => {
  const deps = createSeedDeps(admin, null);
  const first = await seedTrip(deps, { groupId, userId, data: data as SeedTrip });
  const after1 = await counts();
  const second = await seedTrip(deps, { groupId, userId, data: data as SeedTrip });
  expect(first).toEqual({ created: 17, verified: 0, unverified: 17 });
  expect(second.created).toBe(0);
  expect(await counts()).toEqual(after1);
  expect(after1[0]).toBeGreaterThanOrEqual(17);
  const { count } = await admin.from('places').select('*', { count: 'exact', head: true }).eq('group_id', groupId);
  expect(count).toBe(17);

  const trip = (await admin.from('trips').select('id, party_size').eq('group_id', groupId).single()).data!;
  expect(trip.party_size).toBe(4);
  const tps = (await admin.from('trip_places').select('cost, visit_date').eq('trip_id', trip.id)).data!;
  expect(tps).toHaveLength(14);
  expect(tps.reduce((s, r) => s + (r.cost ?? 0), 0)).toBe(660000);
  expect(tps.every((r) => r.visit_date !== null)).toBe(true);
  expect((await admin.from('trip_expenses').select('amount').eq('trip_id', trip.id)).data).toEqual([{ amount: 1062000 }]);
  expect((await admin.from('trip_infos').select('id').eq('trip_id', trip.id)).data).toHaveLength(3);
});
