import { describe, expect, test, vi } from 'vitest';
import { seedTrip, type SeedDeps, type SeedTrip } from '@/features/places/services/seed-service';
import { normalizeText } from '@/shared/text';
import type { PlaceCandidate } from '@/integrations/google-places/types';

const data: SeedTrip = {
  name: 'Hải Phòng',
  city: 'Hải Phòng',
  startDate: '2026-11-23',
  endDate: '2026-11-24',
  places: [
    { name: 'Quán A', address: '1 A', category: 'food', status: 'confirmed', verdict: null, note: 'a' },
    { name: 'Quán B', address: '2 B', category: 'snack', status: 'wanted', verdict: 'up', note: 'b' },
    { name: 'Quán C', address: '3 C', category: 'food', status: null, verdict: 'down', note: 'Không ngon' },
    { name: 'Sủi dìn', address: '(chưa chọn quán)', category: 'snack', status: 'wanted', verdict: null, note: 'x' },
  ],
};
const ids = { groupId: 'g1', userId: 'u1' };

/** Kho giả trong bộ nhớ, đủ ngữ nghĩa để kiểm idempotency. */
function fakeDeps(search: (q: string) => PlaceCandidate | null = () => null) {
  const places: { id: string; googleId: string | null; name: string; verified: boolean }[] = [];
  const trips: { id: string; name: string; startDate: string }[] = [];
  const tripPlaces: { id: string; tripId: string; placeId: string; status: string }[] = [];
  const reviews: { placeId: string; verdict: string; note: string }[] = [];
  let n = 0;
  const searchOne = vi.fn(async (q: string) => search(q));
  const deps: SeedDeps = {
    searchOne,
    findTrip: async (_g, name, startDate) => trips.find((t) => t.name === name && t.startDate === startDate) ?? null,
    createTrip: async (i) => {
      const t = { id: `t${++n}`, name: i.name, startDate: i.startDate };
      trips.push(t);
      return t;
    },
    upsertGooglePlace: async (_g, c) => {
      const old = places.find((p) => p.googleId === c.googlePlaceId);
      if (old) return { id: old.id, isNew: false };
      const p = { id: `p${++n}`, googleId: c.googlePlaceId, name: c.name, verified: true };
      places.push(p);
      return { id: p.id, isNew: true };
    },
    findLocalPlace: async (_g, _c, nameNorm) =>
      places.find((p) => p.googleId === null && normalizeText(p.name) === nameNorm) ?? null,
    createLocalPlace: async (i) => {
      const p = { id: `p${++n}`, googleId: null, name: i.name, verified: false };
      places.push(p);
      return { id: p.id };
    },
    addPlaceToTrip: async (tripId, placeId) => {
      let tp = tripPlaces.find((x) => x.tripId === tripId && x.placeId === placeId);
      if (!tp) tripPlaces.push((tp = { id: `tp${++n}`, tripId, placeId, status: 'wanted' }));
      return { id: tp.id, status: tp.status };
    },
    setTripPlaceStatus: async (id, status) => {
      tripPlaces.find((x) => x.id === id)!.status = status;
    },
    hasReview: async (placeId, _u, verdict) => reviews.some((r) => r.placeId === placeId && r.verdict === verdict),
    addReview: async (r) => void reviews.push(r),
  };
  return { deps, places, trips, tripPlaces, reviews, searchOne };
}

const found = (q: string): PlaceCandidate => ({
  googlePlaceId: `gid-${q}`, name: q, address: 'addr', rating: 4, reviewCount: 10, priceTier: 1, openNow: null, mapsUrl: 'u',
});

describe('seedTrip', () => {
  test('seed 2 lần → số places và trip_places không đổi', async () => {
    const f = fakeDeps(found);
    await seedTrip(f.deps, { ...ids, data });
    const counts = [f.places.length, f.tripPlaces.length, f.trips.length, f.reviews.length];
    await seedTrip(f.deps, { ...ids, data });
    expect([f.places.length, f.tripPlaces.length, f.trips.length, f.reviews.length]).toEqual(counts);
    expect(counts).toEqual([4, 3, 1, 2]);
  });

  test('seed 2 lần với place không xác minh cũng không nhân đôi', async () => {
    const f = fakeDeps();
    await seedTrip(f.deps, { ...ids, data });
    const r = await seedTrip(f.deps, { ...ids, data });
    expect(f.places).toHaveLength(4);
    expect(r.created).toBe(0);
  });

  test('verdict down tạo place_reviews_internal verdict down', async () => {
    const f = fakeDeps();
    await seedTrip(f.deps, { ...ids, data });
    const c = f.places.find((p) => p.name === 'Quán C')!;
    expect(f.reviews).toContainEqual({ placeId: c.id, userId: 'u1', verdict: 'down', note: 'Không ngon', tripId: undefined });
  });

  test('status null không tạo trip_places', async () => {
    const f = fakeDeps();
    await seedTrip(f.deps, { ...ids, data });
    const c = f.places.find((p) => p.name === 'Quán C')!;
    expect(f.tripPlaces.some((t) => t.placeId === c.id)).toBe(false);
    expect(f.tripPlaces).toHaveLength(3);
  });

  test('searchOne null → place verified=false, google_place_id null', async () => {
    const f = fakeDeps(() => null);
    const r = await seedTrip(f.deps, { ...ids, data });
    expect(f.places.every((p) => !p.verified && p.googleId === null)).toBe(true);
    expect(r).toEqual({ created: 4, verified: 0, unverified: 4 });
  });

  test('Sủi dìn không gọi searchOne', async () => {
    const f = fakeDeps(found);
    const r = await seedTrip(f.deps, { ...ids, data });
    expect(f.searchOne).toHaveBeenCalledTimes(3);
    expect(f.searchOne.mock.calls.flat().some((q) => q.includes('Sủi dìn'))).toBe(false);
    expect(r).toMatchObject({ verified: 3, unverified: 1 });
  });

  test('status confirmed được áp dụng cho trip_places', async () => {
    const f = fakeDeps();
    await seedTrip(f.deps, { ...ids, data });
    expect(f.tripPlaces.map((t) => t.status).sort()).toEqual(['confirmed', 'wanted', 'wanted']);
  });
});
