import 'server-only';
import type { CacheStore } from './cache-store';
import { MemoryCacheStore } from './memory-store';
import { UpstashCacheStore } from './upstash-store';

let store: CacheStore | undefined;

/** Singleton; thiếu env Upstash (dev) thì dùng bộ nhớ trong tiến trình. */
export function getCacheStore(): CacheStore {
  if (!store) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    store = url && token ? new UpstashCacheStore(url, token) : new MemoryCacheStore();
  }
  return store;
}
