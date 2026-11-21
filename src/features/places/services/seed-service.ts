import type { PlaceCandidate, PlacesClient } from '@/integrations/google-places/types';
import { hasRealAddress } from '@/features/places/constants';
import { createPlacesRepo, type StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import type { ReviewVerdict } from '@/features/places/repositories/reviews-repo';
import {
  createTripsRepo,
  type TripPlace,
  type TripPlacePatch,
  type TripPlaceStatus,
  type VisitSchedule,
} from '@/features/trips/repositories/trips-repo';
import type { Db } from '@/shared/supabase/db';
import { normalizeText } from '@/shared/text';

export interface SeedPlace {
  name: string;
  address: string;
  category: StoredPlaceCategory;
  status: 'confirmed' | 'wanted' | null;
  verdict: ReviewVerdict | null;
  note: string;
  /** Khung giờ, cách đi và tổng tiền cả nhóm (VND) theo bảng kế hoạch; chỉ dùng khi chỗ có trong chuyến (status khác null). */
  schedule?: VisitSchedule;
  transport?: string;
  cost?: number;
}
export interface SeedTrip {
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  partySize?: number;
  places: SeedPlace[];
  /** Chi phí không gắn với chỗ nào (vé tàu...), nhận diện theo label. */
  expenses?: { label: string; amount: number }[];
  /** Ghi chú ở tab "Thông tin", nhận diện theo title. */
  notes?: { title: string; body: string }[];
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
  addPlaceToTrip(
    tripId: string,
    placeId: string,
    userId: string,
    note: string,
  ): Promise<Pick<TripPlace, 'id' | 'status' | 'visit_date' | 'transport' | 'cost'>>;
  setTripPlaceStatus(tripPlaceId: string, status: TripPlaceStatus): Promise<void>;
  updateTripPlace(tripPlaceId: string, patch: TripPlacePatch): Promise<void>;
  setPartySize(tripId: string, partySize: number): Promise<void>;
  listExpenseLabels(tripId: string): Promise<string[]>;
  addExpense(i: { tripId: string; userId: string; label: string; amount: number }): Promise<void>;
  listNoteTitles(tripId: string): Promise<string[]>;
  addNote(i: { tripId: string; userId: string; title: string; body: string }): Promise<void>;
  hasReview(placeId: string, userId: string, verdict: ReviewVerdict): Promise<boolean>;
  addReview(i: { placeId: string; userId: string; verdict: ReviewVerdict; note: string }): Promise<void>;
}

export async function seedTrip(
  deps: SeedDeps,
  { groupId, userId, data }: { groupId: string; userId: string; data: SeedTrip },
): Promise<SeedResult> {
  const existingTrip = await deps.findTrip(groupId, data.name, data.startDate);
  const trip =
    existingTrip ??
    (await deps.createTrip({ groupId, name: data.name, city: data.city, startDate: data.startDate, endDate: data.endDate }));
  // Chuyến đã có thì giữ số người nhóm đã chỉnh.
  if (!existingTrip && data.partySize) await deps.setPartySize(trip.id, data.partySize);
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
      // Tương tự: chỉ điền ô còn trống, không đè giờ/cách đi/giá nhóm đã sửa trong app.
      const patch: TripPlacePatch = {
        ...(p.schedule && tp.visit_date === null && { schedule: p.schedule }),
        ...(p.transport && tp.transport === null && { transport: p.transport }),
        ...(p.cost !== undefined && tp.cost === null && { cost: p.cost }),
      };
      if (Object.keys(patch).length > 0) await deps.updateTripPlace(tp.id, patch);
    }
    if (p.verdict && !(await deps.hasReview(placeId, userId, p.verdict))) {
      await deps.addReview({ placeId, userId, verdict: p.verdict, note: p.note });
    }
  }

  const labels = new Set(await deps.listExpenseLabels(trip.id));
  for (const e of data.expenses ?? []) {
    if (!labels.has(e.label)) await deps.addExpense({ tripId: trip.id, userId, ...e });
  }
  const titles = new Set(await deps.listNoteTitles(trip.id));
  for (const n of data.notes ?? []) {
    if (!titles.has(n.title)) await deps.addNote({ tripId: trip.id, userId, ...n });
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
    findLocalPlace: (groupId, cityNorm, nameNorm) => placesRepo.findLocalPlace(groupId, cityNorm, nameNorm),
    createLocalPlace: (i) => placesRepo.createLocalPlace(i),
    addPlaceToTrip: (tripId, placeId, userId, note) => tripsRepo.addPlaceToTrip(tripId, placeId, userId, note || undefined),
    setTripPlaceStatus: (id, status) => tripsRepo.setTripPlaceStatus(id, status),
    updateTripPlace: (id, patch) => tripsRepo.updateTripPlace(id, patch),
    setPartySize: (tripId, n) => tripsRepo.setPartySize(tripId, n),
    async listExpenseLabels(tripId) {
      return mustData(await db.from('trip_expenses').select('label').eq('trip_id', tripId)).map((r) => r.label);
    },
    async addExpense({ tripId, userId, label, amount }) {
      // Repo lấy người tạo từ phiên (default auth.uid()); seed chạy bằng admin nên ghi thẳng created_by.
      must(await db.from('trip_expenses').insert({ trip_id: tripId, label, amount, created_by: userId }));
    },
    async listNoteTitles(tripId) {
      return mustData(await db.from('trip_infos').select('title').eq('trip_id', tripId)).map((r) => r.title);
    },
    async addNote({ tripId, userId, title, body }) {
      must(await db.from('trip_infos').insert({ trip_id: tripId, kind: 'note', title, body, created_by: userId }));
    },
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
