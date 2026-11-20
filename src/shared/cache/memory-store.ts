import type { CacheStore } from './cache-store';

type Entry = { value: unknown; expiresAt: number };

/** Dùng cho test và khi thiếu env Upstash ở dev. */
export class MemoryCacheStore implements CacheStore {
  private readonly data = new Map<string, Entry>();

  private read(k: string): Entry | undefined {
    const e = this.data.get(k);
    if (e && e.expiresAt <= Date.now()) {
      this.data.delete(k);
      return undefined;
    }
    return e;
  }

  async get<T>(k: string): Promise<T | null> {
    const e = this.read(k);
    return e ? (e.value as T) : null;
  }

  async set<T>(k: string, v: T, ttlSec: number): Promise<void> {
    this.data.set(k, { value: v, expiresAt: Date.now() + ttlSec * 1000 });
  }

  // Không có await giữa đọc và ghi nên nguyên tử trong một tiến trình.
  async incr(k: string, ttlSec: number): Promise<number> {
    const e = this.read(k);
    if (!e) {
      this.data.set(k, { value: 1, expiresAt: Date.now() + ttlSec * 1000 });
      return 1;
    }
    e.value = Number(e.value) + 1;
    return e.value as number;
  }

  async decr(k: string): Promise<number> {
    const e = this.read(k);
    const next = Number(e?.value ?? 0) - 1;
    if (e) e.value = next;
    else this.data.set(k, { value: next, expiresAt: Date.now() + 86_400_000 });
    return next;
  }
}
