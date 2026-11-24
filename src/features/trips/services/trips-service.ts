import type { PlaceCandidate } from '@/integrations/google-places/types';
import type { PlacesRepo, StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { AppError } from '@/shared/errors';
import { normalizeText } from '@/shared/text';
import type { ImportRow } from '../import/import-rows';
import type { NewTripInput, Trip, TripPlace, TripPlaceInfo, TripPlacePatch, TripPlaceStatus, TripsRepo, TripSummary, VisitSchedule } from '../repositories/trips-repo';
import { tripDays } from './timeline';

const byDate = (a: string | null, b: string | null) => (a ?? '9999-12-31').localeCompare(b ?? '9999-12-31');

/** Chuyến đã qua khi end_date < hôm nay (giờ VN); thiếu ngày kết thúc thì xét ngày bắt đầu, thiếu cả hai là sắp đi. */
export function splitTrips(trips: TripSummary[], today: string): { upcoming: TripSummary[]; past: TripSummary[] } {
  const isPast = (t: TripSummary) => {
    const end = t.end_date ?? t.start_date;
    return end !== null && end < today;
  };
  return {
    upcoming: trips.filter((t) => !isPast(t)).sort((a, b) => byDate(a.start_date, b.start_date)),
    past: trips.filter(isPast).sort((a, b) => byDate(b.end_date ?? b.start_date, a.end_date ?? a.start_date)),
  };
}

export async function listTrips(repo: Pick<TripsRepo, 'listTrips'>, groupId: string, today: string) {
  return splitTrips(await repo.listTrips(groupId), today);
}

export async function createTrip(repo: Pick<TripsRepo, 'createTrip'>, input: NewTripInput): Promise<Trip> {
  const name = input.name.trim();
  const city = input.city.trim();
  if (!name || !city) throw new AppError('INVALID_TRIP', 'Cần nhập tên chuyến và thành phố.');
  if (input.endDate < input.startDate) throw new AppError('INVALID_TRIP', 'Ngày kết thúc phải sau ngày bắt đầu.');
  return repo.createTrip({ ...input, name, city });
}

export type AddToTripInput = {
  tripId: string;
  userId: string;
  category: StoredPlaceCategory;
  city: string;
  note?: string;
} & ({ candidate: PlaceCandidate; placeId?: never } | { placeId: string; candidate?: never });

/** Place thuộc nhóm của chuyến; RLS chặn thêm chỗ/chuyến của nhóm khác. */
export async function addToTrip(
  deps: { trips: Pick<TripsRepo, 'getTrip' | 'addPlaceToTrip'>; places: Pick<PlacesRepo, 'upsertPlaceFromGoogle'> },
  input: AddToTripInput,
): Promise<TripPlace> {
  const trip = await deps.trips.getTrip(input.tripId);
  if (!trip) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
  const placeId =
    input.placeId ??
    (await deps.places.upsertPlaceFromGoogle(trip.group_id, input.candidate, input.category, input.city, input.userId)).id;
  return deps.trips.addPlaceToTrip(trip.id, placeId, input.userId, input.note);
}

export const setStatus = (repo: Pick<TripsRepo, 'setTripPlaceStatus'>, tripPlaceId: string, status: TripPlaceStatus) =>
  repo.setTripPlaceStatus(tripPlaceId, status);

export const removePlace = (repo: Pick<TripsRepo, 'removeFromTrip'>, tripPlaceId: string) =>
  repo.removeFromTrip(tripPlaceId);

/**
 * Lịch hợp lệ: ngày nằm trong chuyến (khi chuyến có ngày) để timeline không có chỗ "lạc" ngoài lịch,
 * và giờ kết thúc (nếu có) sau giờ bắt đầu.
 */
function assertSchedule(trip: Pick<Trip, 'start_date' | 'end_date'>, schedule: VisitSchedule | null | undefined) {
  if (!schedule) return;
  const days = tripDays(trip);
  if (days.length > 0 && !days.includes(schedule.date)) {
    throw new AppError('INVALID_SCHEDULE', 'Ngày phải nằm trong thời gian của chuyến.');
  }
  if (schedule.endTime !== null && schedule.endTime <= schedule.time) {
    throw new AppError('INVALID_SCHEDULE', 'Giờ kết thúc phải sau giờ bắt đầu.');
  }
}

/** Bỏ khoảng trắng thừa; rỗng nghĩa là chưa ghi phương tiện. */
const cleanTransport = (t: string | null | undefined) => (t === undefined ? undefined : t?.trim() || null);

/** Sửa lịch, phương tiện, giá của một chỗ trong chuyến (một lần ghi). */
export async function updateStop(
  repo: Pick<TripsRepo, 'getTrip' | 'updateTripPlace'>,
  input: { tripId: string; tripPlaceId: string; patch: TripPlacePatch },
): Promise<void> {
  const trip = await repo.getTrip(input.tripId);
  if (!trip) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
  assertSchedule(trip, input.patch.schedule);
  await repo.updateTripPlace(input.tripPlaceId, { ...input.patch, transport: cleanTransport(input.patch.transport) });
}

/** Sửa tên, địa chỉ, loại, ghi chú của một chỗ trong chuyến (mọi thành viên nhóm đều sửa được). */
export async function editTripPlace(repo: Pick<TripsRepo, 'updateTripPlaceInfo'>, tripPlaceId: string, info: TripPlaceInfo): Promise<void> {
  const name = info.name.trim();
  if (!name) throw new AppError('INVALID_PLACE', 'Cần nhập tên quán hoặc địa điểm.');
  await repo.updateTripPlaceInfo(tripPlaceId, { ...info, name, address: info.address.trim(), note: info.note.trim() });
}

export interface ManualPlaceInput {
  tripId: string;
  userId: string;
  name: string;
  address: string;
  category: StoredPlaceCategory;
  note: string;
  schedule: VisitSchedule | null;
  transport: string | null;
  /** Tổng tiền cả nhóm; null là chưa có giá. */
  cost: number | null;
}

/**
 * Thêm chỗ nhóm đã biết tên mà không cần tìm trên Google. Trùng tên (đã chuẩn hóa) với chỗ thêm tay
 * cùng thành phố thì dùng lại chỗ đó, để sổ quán và đánh giá không bị tách đôi.
 */
/**
 * Nhập cả lô chỗ từ file vào chuyến. Chỗ thêm tay cùng tên (bỏ dấu) đã có trong nhóm thì dùng lại, như addManualPlace;
 * ghi một lần qua RPC nên lỗi ở dòng nào thì cả lô không ghi.
 */
export async function importTripPlaces(
  deps: { trips: Pick<TripsRepo, 'getTrip' | 'importPlaces'>; places: Pick<PlacesRepo, 'listLocalPlaces'> },
  input: { tripId: string; rows: ImportRow[] },
): Promise<{ added: number; skipped: number }> {
  if (input.rows.length === 0) throw new AppError('IMPORT_EMPTY', 'Không có dòng hợp lệ để nhập.');
  const trip = await deps.trips.getTrip(input.tripId);
  if (!trip) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');

  const cityNorm = normalizeText(trip.city);
  const known = new Map((await deps.places.listLocalPlaces(trip.group_id, cityNorm)).map((p) => [normalizeText(p.name), p.id]));
  return deps.trips.importPlaces(
    trip.id,
    input.rows.map((r) => ({
      place_id: known.get(normalizeText(r.name)) ?? null,
      name: r.name,
      category: r.category,
      address: r.address,
      maps_url: r.mapsUrl,
      note: r.note,
      city_norm: cityNorm,
    })),
  );
}

export async function addManualPlace(
  deps: {
    trips: Pick<TripsRepo, 'getTrip' | 'addPlaceToTrip' | 'updateTripPlace'>;
    places: Pick<PlacesRepo, 'findLocalPlace' | 'createLocalPlace'>;
  },
  input: ManualPlaceInput,
): Promise<TripPlace> {
  const name = input.name.trim();
  if (!name) throw new AppError('INVALID_PLACE', 'Cần nhập tên quán hoặc địa điểm.');
  const trip = await deps.trips.getTrip(input.tripId);
  if (!trip) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
  assertSchedule(trip, input.schedule);

  const existing = await deps.places.findLocalPlace(trip.group_id, normalizeText(trip.city), normalizeText(name));
  const placeId =
    existing?.id ??
    (
      await deps.places.createLocalPlace({
        groupId: trip.group_id,
        userId: input.userId,
        name,
        address: input.address.trim() || null,
        city: trip.city,
        category: input.category,
      })
    ).id;
  const row = await deps.trips.addPlaceToTrip(trip.id, placeId, input.userId, input.note.trim() || undefined);
  // Chỉ ghi những gì người dùng đã nhập, để chỗ trùng tên đã có trong chuyến không bị xóa giờ/giá cũ.
  const patch: TripPlacePatch = {
    ...(input.schedule && { schedule: input.schedule }),
    ...(cleanTransport(input.transport) && { transport: cleanTransport(input.transport) }),
    ...(input.cost !== null && { cost: input.cost }),
  };
  if (Object.keys(patch).length === 0) return row;
  await deps.trips.updateTripPlace(row.id, patch);
  return {
    ...row,
    ...(patch.schedule && { visit_date: patch.schedule.date, visit_time: patch.schedule.time, visit_end_time: patch.schedule.endTime }),
    ...(patch.transport !== undefined && { transport: patch.transport }),
    ...(patch.cost !== undefined && { cost: patch.cost }),
  };
}
