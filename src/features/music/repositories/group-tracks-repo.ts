import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type GroupTrack = Database['public']['Tables']['group_tracks']['Row'];
export type NewGroupTrack = Omit<Database['public']['Tables']['group_tracks']['Insert'], 'id' | 'created_at' | 'created_by'>;

export interface GroupTracksRepo {
  /** Cũ trước (thứ tự thêm vào là thứ tự phát). */
  list(groupId: string): Promise<GroupTrack[]>;
  count(groupId: string): Promise<number>;
  hasYoutube(groupId: string, youtubeId: string): Promise<boolean>;
  insert(row: NewGroupTrack): Promise<GroupTrack>;
  /** Chuyển bài sang thư mục khác (null = Chưa phân loại); null nếu không có hoặc không có quyền. */
  move(id: string, folderId: string | null): Promise<GroupTrack | null>;
  /** Xóa và trả dòng đã xóa (để dọn Cloudinary); null nếu không có hoặc không có quyền. */
  remove(id: string): Promise<GroupTrack | null>;
}

/** db là client theo phiên người dùng: RLS chỉ cho thấy/ghi nhạc của nhóm mình. */
export function createGroupTracksRepo(db: Db): GroupTracksRepo {
  return {
    async list(groupId) {
      const { data, error } = await db.from('group_tracks').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    async count(groupId) {
      const { count, error } = await db.from('group_tracks').select('id', { count: 'exact', head: true }).eq('group_id', groupId);
      if (error) throw error;
      return count ?? 0;
    },
    async hasYoutube(groupId, youtubeId) {
      const { data, error } = await db.from('group_tracks').select('id').eq('group_id', groupId).eq('youtube_id', youtubeId).limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    async insert(row) {
      const { data, error } = await db.from('group_tracks').insert(row).select('*').single();
      if (error) throw error;
      return data;
    },
    async move(id, folderId) {
      const { data, error } = await db.from('group_tracks').update({ folder_id: folderId }).eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
    async remove(id) {
      const { data, error } = await db.from('group_tracks').delete().eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}
