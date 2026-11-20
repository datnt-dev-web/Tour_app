import 'server-only';
import { AppError } from '@/shared/errors';
import { getEnv } from '@/shared/config/env';
import type { CacheStore } from './cache-store';
import { MemoryCacheStore } from './memory-store';
import { UpstashCacheStore } from './upstash-store';

let store: CacheStore | undefined;

/** Singleton; thiếu env Upstash thì dùng bộ nhớ trong tiến trình (chỉ dev; production throw vì bộ đếm quota sẽ lệch theo tiến trình). */
export function getCacheStore(): CacheStore {
  if (!store) {
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getEnv();
    if (url && token) {
      store = new UpstashCacheStore(url, token);
    } else if (process.env.NODE_ENV === 'production') {
      throw new AppError('CACHE_NOT_CONFIGURED', 'Thiếu cấu hình Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN) ở môi trường production.');
    } else {
      store = new MemoryCacheStore();
    }
  }
  return store;
}
