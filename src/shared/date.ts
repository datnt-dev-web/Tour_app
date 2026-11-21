const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;

/** Ngày hôm nay (YYYY-MM-DD) theo giờ Việt Nam, không phụ thuộc múi giờ của máy chạy. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Số ngày lịch từ `today` đến `date` (cả hai dạng YYYY-MM-DD); âm nếu đã qua. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
}

/** "2026-12-01" thành "01/12" */
export function formatDayMonth(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/** Thứ hôm nay theo giờ Việt Nam, thứ Hai = 0 … Chủ nhật = 6 (cùng thứ tự weekdayDescriptions của Google). */
export function weekdayIndexInVietnam(now: Date = new Date()): number {
  return (new Date(`${todayInVietnam(now)}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Giờ hiện tại "HH:MM" theo giờ Việt Nam. */
export function nowHHMMInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: VN_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}
