import type { BadgeTone } from '@/shared/ui/badge';
import type { TripPlaceStatus } from './repositories/trips-repo';

export const STATUS_LABELS: Record<TripPlaceStatus, string> = {
  wanted: 'Chưa chốt',
  confirmed: 'Đã chốt',
  visited: 'Đã đi',
  dropped: 'Bỏ',
};

export const STATUS_TONES: Record<TripPlaceStatus, BadgeTone> = {
  wanted: 'warn',
  confirmed: 'good',
  visited: 'neutral',
  dropped: 'bad',
};

export const TRIP_PLACE_STATUSES = Object.keys(STATUS_LABELS) as TripPlaceStatus[];

/** Gợi ý nhanh cho cột "Di chuyển"; vẫn gõ tự do được (lưu dạng chữ). */
export const TRANSPORT_PRESETS = ['Đi bộ', 'Xe máy', 'Xe máy thuê', 'Taxi/Grab', 'Ô tô', 'Xe buýt', 'Tàu', 'Máy bay'];

/** Nút chọn nhanh thời lượng ở một chỗ (phút), để đặt giờ kết thúc theo giờ bắt đầu. */
export const DURATION_PRESETS_MIN = [30, 45, 60, 90, 120];

/** Cột của file nhập danh sách chỗ (dấu * = bắt buộc). Ghép theo tiêu đề nên người dùng đổi thứ tự cột vẫn được. */
export const IMPORT_COLUMNS = ['Tên quán*', 'Loại*', 'Địa chỉ', 'Link bản đồ', 'Ghi chú'] as const;
/** Một lần nhập tối đa ngần này dòng: đủ cho một chuyến, chặn file rác làm nặng server. */
export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_BYTES = 1_000_000;
/** xlsx là file zip: 1 MB nén có thể bung ra hàng trăm MB. Kiểm trước khi nạp để không làm cạn bộ nhớ server. */
export const IMPORT_MAX_UNZIPPED_BYTES = 20_000_000;

export type TripTab = 'all' | 'confirmed' | 'wanted';

export const TRIP_TABS: { value: TripTab; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'confirmed', label: 'Đã chốt' },
  { value: 'wanted', label: 'Chưa chốt' },
];

/** Trạng thái hiển thị theo tab; 'dropped' không bao giờ hiện. */
export const TAB_STATUSES: Record<TripTab, TripPlaceStatus[]> = {
  all: ['wanted', 'confirmed', 'visited'],
  confirmed: ['confirmed', 'visited'],
  wanted: ['wanted'],
};

/** Link xem lịch trình tự hết hạn sau ngần này ngày (chia sẻ xong chuyến là thôi).
 *  Để ở đây chứ không ở services/share.ts: file đó dùng node:crypto, client import vào sẽ kéo theo polyfill crypto ~140 KB. */
export const SHARE_TTL_DAYS = 30;

/** Tab Hôm nay: hai chỗ chưa đi cách nhau (đường đi) không quá ngần này mét thì gợi ý "Gần đó". */
export const NEARBY_MAX_M = 1000;
/** Mỗi thẻ gợi ý tối đa ngần này chỗ gần đó. */
export const NEARBY_LIMIT = 2;
/** Khối "Gần bạn nhất" gợi ý tối đa ngần này chỗ. */
export const NEAREST_LIMIT = 3;
/** Ô lưới vị trí (~200 m): đi trong một ô thì không tính lại quãng đường từ chỗ mình. */
export const ORIGIN_GRID_DEG = 0.002;
/** Một lần tính tối đa ngần này chỗ (đủ cho một ngày, chặn yêu cầu quá lớn lên máy chủ định tuyến). */
export const DISTANCES_MAX_STOPS = 25;

