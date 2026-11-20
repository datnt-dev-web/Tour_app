import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type Group = Database['public']['Tables']['groups']['Row'];

export interface GroupsRepo {
  /** Nhóm của user, mới tạo nhất trước. */
  listGroups(userId: string): Promise<Group[]>;
}

export function createGroupsRepo(db: Db): GroupsRepo {
  return {
    async listGroups(userId) {
      const { data, error } = await db.from('group_members').select('groups(*)').eq('user_id', userId);
      if (error) throw error;
      return data
        .flatMap((row) => (row.groups ? [row.groups] : []))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  };
}
