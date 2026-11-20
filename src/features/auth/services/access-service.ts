import type { InvitesRepo } from '@/features/groups/repositories/invites-repo';
import { findUsableInvite } from '@/features/groups/services/invite-service';

export type Access = 'member' | 'invite' | 'bootstrap' | 'denied';

export const BOOTSTRAP_GROUP_NAME = 'Con lợn nhựa';

/** Cổng vào app (Supabase vẫn cho đăng ký tự do, đây mới là chỗ chặn). `bootstrapEmails` đã lowercase từ env. */
export async function canAccess(
  repo: InvitesRepo,
  user: { id: string; email?: string | null },
  bootstrapEmails: string[],
  pendingToken?: string,
): Promise<Access> {
  if (await repo.hasAnyGroup(user.id)) return 'member';
  if (user.email && bootstrapEmails.includes(user.email.toLowerCase())) {
    await repo.createGroupWithOwner(BOOTSTRAP_GROUP_NAME, user.id);
    return 'bootstrap';
  }
  if (pendingToken && (await findUsableInvite(repo, pendingToken))) return 'invite';
  return 'denied';
}
