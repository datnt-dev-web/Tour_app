import { AppError } from '@/shared/errors';
import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';
import type { Place } from '@/features/places/repositories/places-repo';

export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripPlace = Database['public']['Tables']['trip_places']['Row'];
export type TripPlaceStatus = Database['public']['Enums']['trip_place_status'];
export type TripSummary = Trip & { confirmedCount: number; pendingCount: number };
export type TripPlaceItem = TripPlace & { place: Place };
export interface TripDetail {
  trip: Trip;
  items: TripPlaceItem[];
}
export interface NewTripInput {
  groupId: string;
  name: string;
  city: string;
  startDate: string;
  endDate: string;
}

export interface TripsRepo {
  createTrip(input: NewTripInput): Promise<Trip>;
  listTrips(groupId: string): Promise<TripSummary[]>;
  getTrip(tripId: string): Promise<Trip | null>;
  getTripDetail(tripId: string): Promise<TripDetail | null>;
  /** Đã có (trip_id, place_id) thì trả dòng cũ, giữ nguyên status và note (riêng dropped được đưa về wanted). */
  addPlaceToTrip(tripId: string, placeId: string, userId: string, note?: string): Promise<TripPlace>;
  setTripPlaceStatus(tripPlaceId: string, status: TripPlaceStatus): Promise<void>;
  removeFromTrip(tripPlaceId: string): Promise<void>;
}

type TripRow = Trip & { trip_places: { status: TripPlaceStatus }[] };

/** confirmedCount gồm cả visited (cùng nghĩa với tab "Đã chốt"); dropped không tính. */
export function toSummary({ trip_places, ...trip }: TripRow): TripSummary {
  return {
    ...trip,
    confirmedCount: trip_places.filter((p) => p.status === 'confirmed' || p.status === 'visited').length,
    pendingCount: trip_places.filter((p) => p.status === 'wanted').length,
  };
}

const notFound = () => new AppError('NOT_FOUND', 'Không tìm thấy chỗ trong chuyến.');

export function createTripsRepo(db: Db): TripsRepo {
  async function getTrip(tripId: string): Promise<Trip | null> {
    const { data, error } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (error) throw error;
    return data;
  }

  return {
    async createTrip({ groupId, name, city, startDate, endDate }) {
      const { data, error } = await db
        .from('trips')
        .insert({ group_id: groupId, name, city, start_date: startDate, end_date: endDate })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async listTrips(groupId) {
      const { data, error } = await db.from('trips').select('*, trip_places(status)').eq('group_id', groupId);
      if (error) throw error;
      return data.map(toSummary);
    },

    getTrip,

    async getTripDetail(tripId) {
      const [trip, items] = await Promise.all([
        getTrip(tripId),
        db.from('trip_places').select('*, place:places(*)').eq('trip_id', tripId).order('id'),
      ]);
      if (items.error) throw items.error;
      if (!trip) return null;
      return { trip, items: items.data.flatMap((row) => (row.place ? [{ ...row, place: row.place }] : [])) };
    },

    async addPlaceToTrip(tripId, placeId, userId, note) {
      const { error } = await db
        .from('trip_places')
        .upsert(
          { trip_id: tripId, place_id: placeId, added_by: userId, note: note ?? null },
          { onConflict: 'trip_id,place_id', ignoreDuplicates: true },
        );
      if (error) throw error;
      // Đã bỏ (dropped) mà thêm lại nghĩa là muốn đi lại; các trạng thái khác giữ nguyên.
      const { error: reviveError } = await db
        .from('trip_places')
        .update({ status: 'wanted' })
        .eq('trip_id', tripId)
        .eq('place_id', placeId)
        .eq('status', 'dropped');
      if (reviveError) throw reviveError;
      const { data, error: selectError } = await db
        .from('trip_places')
        .select('*')
        .eq('trip_id', tripId)
        .eq('place_id', placeId)
        .single();
      if (selectError) throw selectError;
      return data;
    },

    async setTripPlaceStatus(tripPlaceId, status) {
      const { data, error } = await db.from('trip_places').update({ status }).eq('id', tripPlaceId).select('id');
      if (error) throw error;
      if (data.length === 0) throw notFound();
    },

    async removeFromTrip(tripPlaceId) {
      const { data, error } = await db.from('trip_places').delete().eq('id', tripPlaceId).select('id');
      if (error) throw error;
      if (data.length === 0) throw notFound();
    },
  };
}
