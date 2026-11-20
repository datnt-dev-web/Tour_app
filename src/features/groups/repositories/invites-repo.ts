import type { Db } from '@/shared/supabase/db';

export interface InviteRow {
  id: string;
  group_id: string;
  expires_at: string;
  used_by: string | null;
}

/** Mọi thao tác ở đây ghi bảng chỉ service role được chạm, nên `db` phải là client admin. */
export interface InvitesRepo {
  insertInvite(i: { token: string; groupId: string; createdBy: string; expiresAt: string }): Promise<void>;
  findInvite(token: string): Promise<InviteRow | null>;
  /** Đánh dấu đã dùng nếu chưa ai dùng; false nghĩa là bị người khác dùng trước. */
  markUsed(inviteId: string, userId: string): Promise<boolean>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  addMember(groupId: string, userId: string, role: 'owner' | 'member'): Promise<void>;
  hasAnyGroup(userId: string): Promise<boolean>;
  /** Tạo nhóm và gắn người tạo làm owner. */
  createGroupWithOwner(name: string, userId: string): Promise<string>;
}

export function createInvitesRepo(db: Db): InvitesRepo {
  const addMember: InvitesRepo['addMember'] = async (groupId, userId, role) => {
    const { error } = await db
      .from('group_members')
      .upsert({ group_id: groupId, user_id: userId, role }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
  };
  return {
    async insertInvite({ token, groupId, createdBy, expiresAt }) {
      const { error } = await db.from('invites').insert({ token, group_id: groupId, created_by: createdBy, expires_at: expiresAt });
      if (error) throw error;
    },
    async findInvite(token) {
      const { data, error } = await db.from('invites').select('id, group_id, expires_at, used_by').eq('token', token).maybeSingle();
      if (error) throw error;
      return data;
    },
    async markUsed(inviteId, userId) {
      const { data, error } = await db
        .from('invites')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('id', inviteId)
        .is('used_by', null)
        .select('id');
      if (error) throw error;
      return data.length > 0;
    },
    async isMember(groupId, userId) {
      const { data, error } = await db.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    addMember,
    async hasAnyGroup(userId) {
      const { data, error } = await db.from('group_members').select('group_id').eq('user_id', userId).limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    async createGroupWithOwner(name, userId) {
      const { data, error } = await db.from('groups').insert({ name, created_by: userId }).select('id').single();
      if (error) throw error;
      await addMember(data.id, userId, 'owner');
      return data.id;
    },
  };
}
