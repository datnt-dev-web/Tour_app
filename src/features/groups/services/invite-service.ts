import { randomBytes } from 'node:crypto';
import { AppError } from '@/shared/errors';
import type { InvitesRepo } from '../repositories/invites-repo';

const TOKEN_BYTES = 32;
export const DEFAULT_INVITE_TTL_DAYS = 7;
const DAY_MS = 86_400_000;

/** `origin` lấy từ request để link mời luôn trỏ đúng domain đang chạy. */
export async function createInvite(
  repo: InvitesRepo,
  { groupId, createdBy, origin, ttlDays = DEFAULT_INVITE_TTL_DAYS }: { groupId: string; createdBy: string; origin: string; ttlDays?: number },
): Promise<{ url: string }> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  await repo.insertInvite({ token, groupId, createdBy, expiresAt: new Date(Date.now() + ttlDays * DAY_MS).toISOString() });
  return { url: `${origin}/invite/${token}` };
}

/** Lời mời còn dùng được (tồn tại, chưa hết hạn, chưa ai dùng), ngược lại null. */
export async function findUsableInvite(repo: InvitesRepo, token: string) {
  const invite = await repo.findInvite(token);
  if (!invite || invite.used_by || Date.parse(invite.expires_at) <= Date.now()) return null;
  return invite;
}

export async function acceptInvite(repo: InvitesRepo, token: string, userId: string): Promise<{ groupId: string }> {
  const invite = await repo.findInvite(token);
  if (!invite) throw new AppError('INVITE_INVALID', 'Link mời không còn hiệu lực.');
  // Người đã trong nhóm bấm lại link thì không đốt token.
  if (await repo.isMember(invite.group_id, userId)) return { groupId: invite.group_id };
  if (invite.used_by || Date.parse(invite.expires_at) <= Date.now() || !(await repo.markUsed(invite.id, userId))) {
    throw new AppError('INVITE_INVALID', 'Link mời không còn hiệu lực.');
  }
  await repo.addMember(invite.group_id, userId, 'member');
  return { groupId: invite.group_id };
}
