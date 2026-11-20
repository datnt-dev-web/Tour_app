import type { CacheStore } from './cache-store';

/** Đọc-qua cache; lỗi từ fn lan ra và không được lưu. Giá trị phải khác null: null coi là miss nên không bao giờ được cache. */
export async function cached<T>(
  store: CacheStore,
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
  opts?: { shouldCache?: (v: T) => boolean },
): Promise<T> {
  const hit = await store.get<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  if (opts?.shouldCache?.(value) ?? true) await store.set(key, value, ttlSec);
  return value;
}
