/** Chữ thường, số, dấu chấm, gạch dưới; khớp CHECK của `profiles.username` trong migration. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,32}$/;

/** Tài khoản do admin cấp không có email thật, nhưng Supabase Auth bắt buộc có email: dùng địa chỉ giả theo username. */
export const ACCOUNT_EMAIL_DOMAIN = 'food-tour.local';

export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();
