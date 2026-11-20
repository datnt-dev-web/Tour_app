import type { PlaceCandidate } from '@/integrations/google-places/types';
import type { PlacesRepo, StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { AppError } from '@/shared/errors';
import type { NewTripInput, Trip, TripPlace, TripPlaceStatus, TripsRepo, TripSummary } from '../repositories/trips-repo';

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
