import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type MusicFolder = Database['public']['Tables']['music_folders']['Row'];

export interface MusicFoldersRepo {
  /** Cũ trước (thư mục tạo trước đứng trước). */
  list(groupId: string): Promise<MusicFolder[]>;
  insert(groupId: string, name: string): Promise<MusicFolder>;
  rename(id: string, name: string): Promise<MusicFolder | null>;
  /** Bài trong thư mục tự về "Chưa phân loại" (khóa ngoại on delete set null). */
  remove(id: string): Promise<MusicFolder | null>;
}

/** db là client theo phiên người dùng: RLS chỉ cho thấy/ghi thư mục của nhóm mình. */
export function createMusicFoldersRepo(db: Db): MusicFoldersRepo {
  return {
    async list(groupId) {
      const { data, error } = await db.from('music_folders').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    async insert(groupId, name) {
      const { data, error } = await db.from('music_folders').insert({ group_id: groupId, name }).select('*').single();
      if (error) throw error;
      return data;
    },
    async rename(id, name) {
      const { data, error } = await db.from('music_folders').update({ name }).eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
    async remove(id) {
      const { data, error } = await db.from('music_folders').delete().eq('id', id).select('*');
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}
