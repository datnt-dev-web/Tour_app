import type { MembersRepo } from '@/features/groups/repositories/members-repo';
import { AppError } from '@/shared/errors';
import { normalizeUsername, USERNAME_PATTERN } from '../constants';
import type { AccountsRepo } from '../repositories/accounts-repo';

const invalidLogin = () => new AppError('INVALID_LOGIN', 'Tên đăng nhập không đúng hoặc chưa được cấp quyền.');

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
