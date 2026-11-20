import type { Json } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export interface AiCacheRepo {
  /** Dòng hết hạn coi như không có. */
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
}

/** Bảng ai_cache chỉ service role truy cập: truyền client admin (createAdminSupabase), không dùng client phiên người dùng. */
export function createAiCacheRepo(db: Db): AiCacheRepo {
  return {
    async get<T>(key: string) {
      const { data, error } = await db.from('ai_cache').select('value').eq('key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (error) throw error;
      return (data?.value as T | undefined) ?? null;
    },

    async set(key, value, ttlSec) {
      const { error } = await db
        .from('ai_cache')
        .upsert({ key, value: value as NonNullable<Json>, expires_at: new Date(Date.now() + ttlSec * 1000).toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
  };
}
