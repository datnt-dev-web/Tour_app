import { AppError } from '@/shared/errors';
import type { Database, Json } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';
import type { Place, StoredPlaceCategory } from '@/features/places/repositories/places-repo';

export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripPlace = Database['public']['Tables']['trip_places']['Row'];
export type TripPlaceStatus = Database['public']['Enums']['trip_place_status'];
export type TripSummary = Trip & { confirmedCount: number; pendingCount: number };
export type TripPlaceItem = TripPlace & { place: Place };
export type TripExpense = Database['public']['Tables']['trip_expenses']['Row'];
/** Toàn bộ chỗ của chuyến (kể cả đã bỏ); chỉ dùng ở server cho bản đồ. */
export interface TripDetail {
  trip: Trip;
  items: TripPlaceItem[];
}
/** Phần đầu màn chuyến: thông tin chuyến và chi phí khác (luôn ngắn, không cần phân trang). */
export interface TripInfo {
  trip: Trip;
  expenses: TripExpense[];
  /** Người xem là owner nhóm (admin): chỉ họ sửa được tiền (database cũng chặn, cờ này để ẩn ô sửa). */
  canEditMoney: boolean;
}
/** Một chỗ còn hiệu lực trong chuyến (view trip_stops): kèm loại chỗ và cờ trùng giờ tính ở database. */
export type TripStop = Database['public']['Views']['trip_stops']['Row'] & { place: Place };

/** Một dòng gửi vào RPC import_trip_places; place_id null = tạo chỗ mới trong nhóm của chuyến. */
export interface ImportRpcRow {
  place_id: string | null;
  name: string;
  category: StoredPlaceCategory;
  address: string | null;
  maps_url: string | null;
  note: string | null;
  city_norm: string;
}

/** Mỗi trang của Danh sách / Timeline / giá từng chỗ. */
export const STOPS_PAGE_SIZE = 20;

/**
 * Truy vấn một trang chỗ của chuyến. `order`: 'category' cho Danh sách (gom theo loại),
 * 'schedule' cho Timeline (theo ngày, giờ). `day`: 'all', 'none' (chưa xếp giờ) hoặc YYYY-MM-DD.
 */
export interface StopsQuery {
  order: 'category' | 'schedule';
  statuses: TripPlaceStatus[];
  day: string;
  /** Bắt đầu từ 1. */
  page: number;
}
export interface StopsPage {
  items: TripStop[];
  total: number;
}
/** Số liệu thô từ hàm trip_stats (tiền là tổng cả nhóm, VND). */
export interface RawTripStats {
  people: number;
  placesTotal: number;
  expensesTotal: number;
  visitedTotal: number;
  priced: number;
  active: number;
  visited: number;
  confirmed: number;
  wanted: number;
  byCategory: { category: Database['public']['Enums']['place_category']; total: number; count: number }[];
  byDay: { date: string | null; total: number }[];
}
/** Giờ địa phương của chuyến: ngày YYYY-MM-DD, giờ HH:MM; giờ kết thúc không bắt buộc. */
export interface VisitSchedule {
  date: string;
  time: string;
  endTime: string | null;
}

/** Các trường nhóm sửa trên một chỗ của chuyến; khóa vắng mặt là giữ nguyên. */
export interface TripPlacePatch {
  /** null là bỏ giờ (chỗ quay về mục "Chưa xếp giờ"). */
  schedule?: VisitSchedule | null;
  transport?: string | null;
  /** Tổng tiền cả nhóm (VND); null là chưa có giá. */
  cost?: number | null;
  /** Người tham gia đã trả khoản này; null là chưa ghi (không vào chia tiền). */
  paidBy?: string | null;
}
/** Các trường sửa trên một khoản chi phí khác; khóa vắng mặt là giữ nguyên. */
export interface TripExpensePatch {
  label?: string;
  amount?: number;
  paidBy?: string | null;
}
/** Thông tin sửa ở tab Danh sách: tên/địa chỉ/loại của chỗ (dùng chung với sổ quán) và ghi chú trong chuyến. */
export interface TripPlaceInfo {
  name: string;
  /** Rỗng là không có địa chỉ. */
  address: string;
  category: StoredPlaceCategory;
  /** Rỗng là không có ghi chú. */
  note: string;
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
  getTripInfo(tripId: string): Promise<TripInfo | null>;
  listStops(tripId: string, query: StopsQuery): Promise<StopsPage>;
  getTripStats(tripId: string): Promise<RawTripStats | null>;
  /** Đã có (trip_id, place_id) thì trả dòng cũ, giữ nguyên status và note (riêng dropped được đưa về wanted). */
  addPlaceToTrip(tripId: string, placeId: string, userId: string, note?: string): Promise<TripPlace>;
  setTripPlaceStatus(tripPlaceId: string, status: TripPlaceStatus): Promise<void>;
  updateTripPlace(tripPlaceId: string, patch: TripPlacePatch): Promise<void>;
  /** Ghi cả places và trip_places trong một transaction (RPC update_trip_place_info). */
  updateTripPlaceInfo(tripPlaceId: string, info: TripPlaceInfo): Promise<void>;
  setPartySize(tripId: string, partySize: number): Promise<void>;
  addExpense(tripId: string, label: string, amount: number, paidBy?: string | null): Promise<TripExpense>;
  updateExpense(expenseId: string, patch: TripExpensePatch): Promise<void>;
  removeExpense(expenseId: string): Promise<void>;
  removeFromTrip(tripPlaceId: string): Promise<void>;
  /** Thêm cả lô trong một transaction; chỗ đã có trong chuyến thì bỏ qua (kể cả đang ở trạng thái Bỏ). */
  importPlaces(tripId: string, rows: ImportRpcRow[]): Promise<{ added: number; skipped: number }>;
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
/** 23503: người trả không thuộc chuyến này (khóa ngoại (trip_id, paid_by)). */
const FK_VIOLATION = '23503';
const payerNotInTrip = () => new AppError('VALIDATION', 'Người trả không có trong danh sách người tham gia của chuyến.');
/** PostgREST: offset vượt quá số dòng (HTTP 416). */
const RANGE_NOT_SATISFIABLE = 'PGRST103';
/** RPC update_trip_place_info: không thấy chỗ (không tồn tại hoặc RLS chặn). */
const NO_DATA_FOUND = 'P0002';

export function createTripsRepo(db: Db): TripsRepo {
  async function getTrip(tripId: string): Promise<Trip | null> {
    const { data, error } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (error) throw error;
    return data;
  }

  return {
    async createTrip({ groupId, name, city, startDate, endDate }) {
      // Số người mặc định = số thành viên nhóm; nhóm sửa lại ở tab Thống kê nếu có người không đi.
      const { count, error: countError } = await db.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', groupId);
      if (countError) throw countError;
      const { data, error } = await db
        .from('trips')
        .insert({ group_id: groupId, name, city, start_date: startDate, end_date: endDate, party_size: Math.max(1, count ?? 1) })
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
      const [trip, items] = await Promise.all([getTrip(tripId), db.from('trip_places').select('*, place:places(*)').eq('trip_id', tripId).order('id')]);
      if (items.error) throw items.error;
      if (!trip) return null;
      return { trip, items: items.data.flatMap((row) => (row.place ? [{ ...row, place: row.place }] : [])) };
    },

    async getTripInfo(tripId) {
      const [trip, expenses, owner] = await Promise.all([
        getTrip(tripId),
        db.from('trip_expenses').select('*').eq('trip_id', tripId).order('created_at'),
        db.rpc('is_trip_owner', { p_trip_id: tripId }),
      ]);
      if (expenses.error) throw expenses.error;
      if (owner.error) throw owner.error;
      return trip ? { trip, expenses: expenses.data, canEditMoney: owner.data === true } : null;
    },

    async listStops(tripId, { order, statuses, day, page }) {
      const filtered = (columns: string, opts: { count: 'exact'; head?: boolean }) => {
        let q = db.from('trip_stops').select(columns, opts).eq('trip_id', tripId).in('status', statuses);
        if (day === 'none') q = q.is('visit_date', null);
        else if (day !== 'all') q = q.eq('visit_date', day);
        return q;
      };
      let q = filtered('*, place:places(*)', { count: 'exact' }).returns<(Database['public']['Views']['trip_stops']['Row'] & { place: Place | null })[]>();
      if (order === 'category') q = q.order('category');
      q = q
        .order('visit_date', { nullsFirst: false })
        .order('visit_time', { nullsFirst: false })
        .order('id');
      const from = (Math.max(1, page) - 1) * STOPS_PAGE_SIZE;
      const { data, error, count } = await q.range(from, from + STOPS_PAGE_SIZE - 1);
      if (error?.code === RANGE_NOT_SATISFIABLE) {
        // Trang đã vượt tổng (ví dụ nhóm vừa xóa bớt chỗ): trả rỗng kèm tổng mới để giao diện lùi về trang cuối.
        const head = await filtered('id', { count: 'exact', head: true });
        if (head.error) throw head.error;
        return { items: [], total: head.count ?? 0 };
      }
      if (error) throw error;
      return { items: data.flatMap((row) => (row.place ? [{ ...row, place: row.place }] : [])), total: count ?? 0 };
    },

    async importPlaces(tripId, rows) {
      const { data, error } = await db.rpc('import_trip_places', { p_trip_id: tripId, p_rows: rows as unknown as Json });
      if (error) throw error;
      return data as { added: number; skipped: number };
    },

    async getTripStats(tripId) {
      const { data, error } = await db.rpc('trip_stats', { p_trip_id: tripId });
      if (error) throw error;
      return data as RawTripStats | null;
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

    async updateTripPlace(tripPlaceId, { schedule, transport, cost, paidBy }) {
      const changes = {
        ...(schedule !== undefined && {
          visit_date: schedule?.date ?? null,
          visit_time: schedule?.time ?? null,
          visit_end_time: schedule?.endTime ?? null,
        }),
        ...(transport !== undefined && { transport }),
        ...(cost !== undefined && { cost }),
        ...(paidBy !== undefined && { paid_by: paidBy }),
      };
      // Không có gì để ghi: PostgREST sẽ không chạm dòng nào và bị hiểu nhầm thành "không tìm thấy".
      if (Object.keys(changes).length === 0) return;
      const { data, error } = await db
        .from('trip_places')
        .update(changes)
        .eq('id', tripPlaceId)
        .select('id');
      if (error?.code === FK_VIOLATION) throw payerNotInTrip();
      if (error) throw error;
      if (data.length === 0) throw notFound();
    },

    async updateTripPlaceInfo(tripPlaceId, { name, address, category, note }) {
      const { error } = await db.rpc('update_trip_place_info', {
        p_trip_place_id: tripPlaceId,
        p_name: name,
        p_address: address,
        p_category: category,
        p_note: note,
      });
      if (error?.code === NO_DATA_FOUND) throw notFound();
      if (error) throw error;
    },

    async setPartySize(tripId, partySize) {
      const { data, error } = await db.from('trips').update({ party_size: partySize }).eq('id', tripId).select('id');
      if (error) throw error;
      if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
    },

    async addExpense(tripId, label, amount, paidBy = null) {
      const { data, error } = await db.from('trip_expenses').insert({ trip_id: tripId, label, amount, paid_by: paidBy }).select('*').single();
      if (error?.code === FK_VIOLATION) throw payerNotInTrip();
      if (error) throw error;
      return data;
    },

    async updateExpense(expenseId, { label, amount, paidBy }) {
      const changes = {
        ...(label !== undefined && { label }),
        ...(amount !== undefined && { amount }),
        ...(paidBy !== undefined && { paid_by: paidBy }),
      };
      if (Object.keys(changes).length === 0) return;
      // Không phải admin thì RLS lọc mất dòng (0 dòng), nên "không tìm thấy" cũng gồm trường hợp không có quyền.
      const { data, error } = await db.from('trip_expenses').update(changes).eq('id', expenseId).select('id');
      if (error?.code === FK_VIOLATION) throw payerNotInTrip();
      if (error) throw error;
      if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy khoản chi.');
    },

    async removeExpense(expenseId) {
      const { data, error } = await db.from('trip_expenses').delete().eq('id', expenseId).select('id');
      if (error) throw error;
      if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy khoản chi.');
    },

    async removeFromTrip(tripPlaceId) {
      const { data, error } = await db.from('trip_places').delete().eq('id', tripPlaceId).select('id');
      if (error) throw error;
      if (data.length === 0) throw notFound();
    },
  };
}
