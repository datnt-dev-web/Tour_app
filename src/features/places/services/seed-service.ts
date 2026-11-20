import type { PlaceCandidate, PlacesClient } from '@/integrations/google-places/types';
import { createPlacesRepo, type StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import type { ReviewVerdict } from '@/features/places/repositories/reviews-repo';
import { createTripsRepo, type TripPlaceStatus } from '@/features/trips/repositories/trips-repo';
import type { Db } from '@/shared/supabase/db';
import { normalizeText } from '@/shared/text';

export interface SeedPlace {
  name: string;
  address: string;
  category: StoredPlaceCategory;
  status: 'confirmed' | 'wanted' | null;
  verdict: ReviewVerdict | null;
  note: string;
}
export interface SeedTrip {
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  places: SeedPlace[];
}
export interface SeedResult {
  created: number;
  verified: number;
  unverified: number;
}

/** Các thao tác seed cần; tách thành cổng để test bằng kho giả, còn CLI dùng `createSeedDeps`. */
export interface SeedDeps {
  searchOne(query: string): Promise<PlaceCandidate | null>;
  findTrip(groupId: string, name: string, startDate: string): Promise<{ id: string } | null>;
  createTrip(i: { groupId: string; name: string; city: string; startDate: string; endDate: string }): Promise<{ id: string }>;
  upsertGooglePlace(
    groupId: string,
    c: PlaceCandidate,
    category: StoredPlaceCategory,
    city: string,
    userId: string,
  ): Promise<{ id: string; isNew: boolean }>;
  findLocalPlace(groupId: string, cityNorm: string, nameNorm: string): Promise<{ id: string } | null>;
  createLocalPlace(i: {
    groupId: string;
    userId: string;
    name: string;
    address: string;
    city: string;
    category: StoredPlaceCategory;
  }): Promise<{ id: string }>;
  addPlaceToTrip(tripId: string, placeId: string, userId: string, note: string): Promise<{ id: string; status: string }>;
  setTripPlaceStatus(tripPlaceId: string, status: TripPlaceStatus): Promise<void>;
  hasReview(placeId: string, userId: string, verdict: ReviewVerdict): Promise<boolean>;
  addReview(i: { placeId: string; userId: string; verdict: ReviewVerdict; note: string }): Promise<void>;
}

/** Chỗ chưa có địa chỉ thật (ví dụ "Sủi dìn") thì không có gì để đối chiếu Google. */
const hasRealAddress = (address: string) => !address.startsWith('(');

export async function seedTrip(
  deps: SeedDeps,
  { groupId, userId, data }: { groupId: string; userId: string; data: SeedTrip },
): Promise<SeedResult> {
  const trip =
    (await deps.findTrip(groupId, data.name, data.startDate)) ??
    (await deps.createTrip({ groupId, name: data.name, city: data.city, startDate: data.startDate, endDate: data.endDate }));
  const result: SeedResult = { created: 0, verified: 0, unverified: 0 };
  const cityNorm = normalizeText(data.city);

  for (const p of data.places) {
    const candidate = hasRealAddress(p.address) ? await deps.searchOne(`${p.name} ${p.address} ${data.city}`) : null;
    let placeId: string;
    if (candidate) {
      const r = await deps.upsertGooglePlace(groupId, candidate, p.category, data.city, userId);
      placeId = r.id;
      if (r.isNew) result.created++;
      result.verified++;
    } else {
      const existing = await deps.findLocalPlace(groupId, cityNorm, normalizeText(p.name));
      if (existing) placeId = existing.id;
      else {
        placeId = (await deps.createLocalPlace({ groupId, userId, name: p.name, address: p.address, city: data.city, category: p.category })).id;
        result.created++;
      }
      result.unverified++;
    }

    if (p.status) {
      const tp = await deps.addPlaceToTrip(trip.id, placeId, userId, p.note);
      // Chỉ nâng trạng thái khi dòng còn ở mặc định; không đè lựa chọn nhóm đã đổi sau đó.
      if (p.status !== 'wanted' && tp.status === 'wanted') await deps.setTripPlaceStatus(tp.id, p.status);
    }
    if (p.verdict && !(await deps.hasReview(placeId, userId, p.verdict))) {
      await deps.addReview({ placeId, userId, verdict: p.verdict, note: p.note });
    }
  }
  return result;
}

/** Nối cổng với repo thật. `db` là client admin (seed chạy ngoài phiên người dùng); places = null khi thiếu khóa Google. */
export function createSeedDeps(db: Db, places: PlacesClient | null): SeedDeps {
  const placesRepo = createPlacesRepo(db);
  const tripsRepo = createTripsRepo(db);
  const must = <T>(r: { data: T; error: unknown }): T => {
    if (r.error) throw r.error;
    return r.data;
  };
  /** Truy vấn không lỗi thì data luôn có (select list/single/insert không returning). */
  const mustData = <T>(r: { data: T; error: unknown }): NonNullable<T> => must(r) as NonNullable<T>;

  return {
    searchOne: async (q) => (places ? places.searchOne(q) : null),
    async findTrip(groupId, name, startDate) {
      return must(await db.from('trips').select('id').eq('group_id', groupId).eq('name', name).eq('start_date', startDate).limit(1).maybeSingle());
    },
    createTrip: (i) => tripsRepo.createTrip(i),
    async upsertGooglePlace(groupId, c, category, city, userId) {
      const old = await placesRepo.findPlace(groupId, { googlePlaceId: c.googlePlaceId });
      const place = await placesRepo.upsertPlaceFromGoogle(groupId, c, category, city, userId);
      return { id: place.id, isNew: !old };
    },
    async findLocalPlace(groupId, cityNorm, nameNorm) {
      const rows = mustData(await db.from('places').select('id, name').eq('group_id', groupId).eq('city_norm', cityNorm).is('google_place_id', null));
      return rows.find((r) => normalizeText(r.name) === nameNorm) ?? null;
    },
    async createLocalPlace({ groupId, userId, name, address, city, category }) {
      return mustData(
        await db
          .from('places')
          .insert({ group_id: groupId, name, address, city, city_norm: normalizeText(city), category, verified: false, created_by: userId })
          .select('id')
          .single(),
      );
    },
    addPlaceToTrip: (tripId, placeId, userId, note) => tripsRepo.addPlaceToTrip(tripId, placeId, userId, note || undefined),
    setTripPlaceStatus: (id, status) => tripsRepo.setTripPlaceStatus(id, status),
    async hasReview(placeId, userId, verdict) {
      const rows = mustData(await db.from('place_reviews_internal').select('id').eq('place_id', placeId).eq('user_id', userId).eq('verdict', verdict).limit(1));
      return rows.length > 0;
    },
    async addReview({ placeId, userId, verdict, note }) {
      // Repo reviews lấy user từ phiên (auth.uid()); seed chạy bằng admin nên ghi thẳng user_id.
      must(await db.from('place_reviews_internal').insert({ place_id: placeId, user_id: userId, verdict, note }));
    },
  };
}
