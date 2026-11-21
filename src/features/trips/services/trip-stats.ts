import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { perPerson } from '@/shared/money';
import type { RawTripStats } from '../repositories/trips-repo';

export interface TripStats {
  people: number;
  /** Tổng tiền các chỗ đã có giá (cả nhóm). */
  placesTotal: number;
  /** Chi phí không gắn với quán: vé tàu, khách sạn, thuê xe... */
  expensesTotal: number;
  total: number;
  perPerson: number;
  /** Đã chi: tiền các chỗ đã đi cộng chi phí khác (vé, phòng thường trả trước). */
  spent: number;
  priced: number;
  /** Chỗ chưa có giá: tổng đang thiếu phần này, giống "món chưa có giá" trong bảng kế hoạch. */
  unpriced: number;
  byCategory: { category: StoredPlaceCategory; total: number; count: number }[];
  /** Theo ngày đã xếp giờ; `dayNumber` null khi ngày nằm ngoài chuyến, `date` null là chỗ chưa xếp giờ. */
  byDay: { date: string | null; dayNumber: number | null; total: number }[];
  progress: { visited: number; confirmed: number; wanted: number; total: number };
}

/**
 * Đổi số liệu database (hàm trip_stats: cộng trên toàn chuyến, chỗ đã bỏ không tính) sang dạng màn Thống kê dùng:
 * thêm tổng chung, chia đầu người, số thứ tự ngày theo lịch chuyến.
 */
export function toTripStats(raw: RawTripStats, days: string[]): TripStats {
  const total = raw.placesTotal + raw.expensesTotal;
  return {
    people: raw.people,
    placesTotal: raw.placesTotal,
    expensesTotal: raw.expensesTotal,
    total,
    perPerson: perPerson(total, raw.people),
    spent: raw.visitedTotal + raw.expensesTotal,
    priced: raw.priced,
    unpriced: raw.active - raw.priced,
    byCategory: raw.byCategory,
    byDay: raw.byDay.map((d) => {
      const index = d.date ? days.indexOf(d.date) : -1;
      return { date: d.date, dayNumber: index === -1 ? null : index + 1, total: d.total };
    }),
    progress: { visited: raw.visited, confirmed: raw.confirmed, wanted: raw.wanted, total: raw.active },
  };
}
