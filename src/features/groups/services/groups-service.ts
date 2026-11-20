import { AppError } from '@/shared/errors';
import type { Group, GroupsRepo } from '../repositories/groups-repo';

/** Cookie chọn nhóm đang xem khi user thuộc nhiều nhóm. */
export const GROUP_COOKIE = 'ft-group';

/** Nhóm theo cookie nếu user thật sự thuộc nhóm đó, ngược lại nhóm mới nhất. */
export async function getCurrentGroup(repo: GroupsRepo, userId: string, preferredGroupId?: string | null): Promise<Group> {
  const groups = await repo.listGroups(userId);
  const group = groups.find((g) => g.id === preferredGroupId) ?? groups[0];
  if (!group) throw new AppError('NO_GROUP', 'Bạn chưa ở nhóm nào.');
  return group;
}
