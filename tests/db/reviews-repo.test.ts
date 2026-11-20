import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { createReviewsRepo } from '@/features/places/repositories/reviews-repo';
import { listBook } from '@/features/places/services/book-service';
import { runAction } from '@/shared/actions';
import type { Database } from '@/shared/supabase/database.types';

const url = process.env.DB_TEST_SUPABASE_URL!;
const anon = process.env.DB_TEST_ANON_KEY!;
const service = process.env.DB_TEST_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);
const run = Date.now();
const password = 'Test-pass-12345';

let user: { id: string; db: SupabaseClient<Database> };
let G: string;
let GX: string;
let tripX: string;

const candidate = (id: string) => ({
  googlePlaceId: id, name: `Quán ${id}`, address: 'Số 1', rating: 4.5, reviewCount: 100, priceTier: 1 as const, openNow: null, mapsUrl: 'u',
});

beforeAll(async () => {
  const email = `reviews-${run}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Lan' } });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, anon, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  user = { id: created.data.user.id, db };
  G = (await admin.from('groups').insert({ name: 'Nhóm review', created_by: user.id }).select('id').single()).data!.id;
  GX = (await admin.from('groups').insert({ name: 'Nhóm ngoài', created_by: user.id }).select('id').single()).data!.id;
  await admin.from('group_members').insert({ group_id: G, user_id: user.id, role: 'owner' });
  tripX = (await admin.from('trips').insert({ group_id: GX, name: 'Chuyến ngoài', city: 'x' }).select('id').single()).data!.id;
});

afterAll(async () => {
  await admin.from('groups').delete().in('id', [G, GX]);
  await admin.auth.admin.deleteUser(user.id);
});

describe('reviews repo + sổ quán', () => {
  test('addReview trả đánh giá kèm tên tác giả; listReviews mới nhất trước; sổ quán lấy verdict mới nhất', async () => {
    const places = createPlacesRepo(user.db);
    const reviews = createReviewsRepo(user.db);
    const p = await places.upsertPlaceFromGoogle(G, candidate('gp-rev'), 'food', 'Hải Phòng', user.id);
    const first = await reviews.addReview({ placeId: p.id, verdict: 'down', note: 'dở' });
    expect(first).toMatchObject({ placeId: p.id, userId: user.id, authorName: 'Lan', verdict: 'down', note: 'dở', tripId: null });
    await new Promise((r) => setTimeout(r, 20));
    await reviews.addReview({ placeId: p.id, verdict: 'up', note: 'lần sau ngon' });
    expect((await reviews.listReviews(p.id)).map((r) => r.verdict)).toEqual(['up', 'down']);

    const book = await listBook(places, G, {});
    expect(book.find((r) => r.placeId === p.id)).toMatchObject({ verdict: 'up', note: 'lần sau ngon' });
    expect((await listBook(places, G, { verdict: 'down' })).some((r) => r.placeId === p.id)).toBe(false);
  });

  test('findPlace theo id và google_place_id, chỗ nhóm khác không thấy', async () => {
    const places = createPlacesRepo(user.db);
    const p = await places.upsertPlaceFromGoogle(G, candidate('gp-find'), 'cafe', 'Hải Phòng', user.id);
    expect(p.verified).toBe(true);
    expect((await places.findPlace(G, { id: p.id }))?.id).toBe(p.id);
    expect((await places.findPlace(G, { googlePlaceId: 'gp-find' }))?.id).toBe(p.id);
    expect(await places.findPlace(GX, { id: p.id })).toBeNull();
  });

  test('RLS: đánh giá với trip của nhóm khác bị chặn (FORBIDDEN qua runAction)', async () => {
    const p = await createPlacesRepo(user.db).upsertPlaceFromGoogle(G, candidate('gp-rls'), 'food', 'x', user.id);
    const r = await runAction(() => createReviewsRepo(user.db).addReview({ placeId: p.id, verdict: 'up', note: null, tripId: tripX }));
    expect(r).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
});
