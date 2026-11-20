import 'server-only';
import { Redis } from '@upstash/redis';
import type { CacheStore } from './cache-store';

export class UpstashCacheStore implements CacheStore {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  get<T>(k: string): Promise<T | null> {
    return this.redis.get<T>(k);
  }

  async set<T>(k: string, v: T, ttlSec: number): Promise<void> {
    await this.redis.set(k, v, { ex: ttlSec });
  }

  async incr(k: string, ttlSec: number): Promise<number> {
    const [count] = await this.redis.pipeline().incr(k).expire(k, ttlSec, 'NX').exec<[number, number]>();
    return count;
  }

  decr(k: string): Promise<number> {
    return this.redis.decr(k);
  }
}
