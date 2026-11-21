import type { Db } from '@/shared/supabase/db';

/** Ghi `groups`/`group_members` chỉ service role được làm (RLS chỉ cho thành viên đọc), nên `db` phải là client admin. */
export interface MembersRepo {
  hasAnyGroup(userId: string): Promise<boolean>;
  addMember(groupId: string, userId: string, role: 'owner' | 'member'): Promise<void>;
  /** Tạo nhóm và gắn người tạo làm owner. */
  createGroupWithOwner(name: string, userId: string): Promise<string>;
}

export function createMembersRepo(db: Db): MembersRepo {
  // Upsert để chạy lại cũng cập nhật role (ví dụ nâng member lên owner).
  const addMember: MembersRepo['addMember'] = async (groupId, userId, role) => {
    const { error } = await db.from('group_members').upsert({ group_id: groupId, user_id: userId, role }, { onConflict: 'group_id,user_id' });
    if (error) throw error;
  };
  return {
    async hasAnyGroup(userId) {
      const { data, error } = await db.from('group_members').select('group_id').eq('user_id', userId).limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    addMember,
    async createGroupWithOwner(name, userId) {
      const { data, error } = await db.from('groups').insert({ name, created_by: userId }).select('id').single();
      if (error) throw error;
      await addMember(data.id, userId, 'owner');
      return data.id;
    },
  };
}
