import type { MembersRepo } from '@/features/groups/repositories/members-repo';
import { AppError } from '@/shared/errors';
import { randomInt } from 'node:crypto';
import { normalizeUsername, PIN_PATTERN, USERNAME_PATTERN } from '../constants';
import type { AccountsRepo } from '../repositories/accounts-repo';

const invalidLogin = () => new AppError('INVALID_LOGIN', 'Tên đăng nhập hoặc PIN không đúng.');

/**
 * Tìm user được phép vào bằng username. Cùng một thông báo lỗi cho mọi trường hợp
 * (sai định dạng, không tồn tại, chưa có nhóm) để không lộ username nào có thật.
 */
export async function findLoginUser(
  deps: { accounts: AccountsRepo; groups: Pick<MembersRepo, 'hasAnyGroup'> },
  rawUsername: string,
): Promise<string> {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_PATTERN.test(username)) throw invalidLogin();
  const userId = await deps.accounts.findUserIdByUsername(username);
  if (!userId || !(await deps.groups.hasAnyGroup(userId))) throw invalidLogin();
  return userId;
}

/**
 * Đăng nhập bằng username + PIN. PIN là mật khẩu của Supabase Auth (Supabase băm và giới hạn số lần thử).
 * Mọi trường hợp sai đều cùng một lỗi để không đoán được username nào có thật.
 */
export async function signInWithPin(
  deps: Parameters<typeof findLoginUser>[0] & {
    findEmail: (userId: string) => Promise<string | null>;
    /** true nếu đăng nhập được (và đã ghi phiên). */
    signIn: (email: string, pin: string) => Promise<boolean>;
  },
  rawUsername: string,
  rawPin: string,
): Promise<void> {
  const pin = rawPin.trim();
  // PIN sai định dạng: dừng trước khi gọi Auth, khỏi tốn lượt giới hạn đăng nhập.
  if (!PIN_PATTERN.test(pin)) throw invalidLogin();
  const email = await deps.findEmail(await findLoginUser(deps, rawUsername));
  if (!email || !(await deps.signIn(email, pin))) throw invalidLogin();
}

/** PIN ngẫu nhiên 6 số cho admin cấp (crypto, không dùng Math.random). */
export const generatePin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Đổi PIN của chính mình: phải nhập đúng PIN hiện tại. */
export async function changePin(
  auth: { verify: (pin: string) => Promise<boolean>; update: (pin: string) => Promise<void> },
  input: { current: string; next: string },
): Promise<void> {
  const current = input.current.trim();
  const next = input.next.trim();
  if (!PIN_PATTERN.test(next)) throw new AppError('INVALID_PIN', 'PIN mới phải gồm đúng 6 chữ số.');
  if (next === current) throw new AppError('INVALID_PIN', 'PIN mới phải khác PIN hiện tại.');
  if (!PIN_PATTERN.test(current) || !(await auth.verify(current))) throw new AppError('WRONG_PIN', 'PIN hiện tại không đúng.');
  await auth.update(next);
}
