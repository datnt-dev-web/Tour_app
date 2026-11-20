import { afterEach, describe, expect, test, vi } from 'vitest';
import { cached } from '@/shared/cache/cached';
import { cacheKey } from '@/shared/cache/keys';
import { MemoryCacheStore } from '@/shared/cache/memory-store';

afterEach(() => vi.useRealTimers());

describe('cacheKey', () => {
  test('cacheKey gộp cách gõ thành phố', () =>
    expect(cacheKey('places:search', { city: 'Hải Phòng', category: 'snack', price: 1 })).toBe(
      cacheKey('places:search', { price: 1, category: 'snack', city: ' hai  phong ' }),
    ));

  test('sắp khóa theo chữ cái, bỏ giá trị undefined', () =>
    expect(cacheKey('ns', { b: 2, a: 'X', c: undefined })).toBe('ns:a=x|b=2'));
});

describe('cached', () => {
  test('cached chỉ gọi fn một lần trong TTL', async () => {
    const store = new MemoryCacheStore();
    const fn = vi.fn().mockResolvedValue('v');
    expect(await cached(store, 'k', 60, fn)).toBe('v');
    expect(await cached(store, 'k', 60, fn)).toBe('v');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cached không lưu khi fn throw', async () => {
    const store = new MemoryCacheStore();
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    await expect(cached(store, 'k', 60, fn)).rejects.toThrow('boom');
    expect(await cached(store, 'k', 60, fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('cached tôn trọng shouldCache=false', async () => {
    const store = new MemoryCacheStore();
    const fn = vi.fn().mockResolvedValue([] as string[]);
    const opts = { shouldCache: (v: string[]) => v.length > 0 };
    await cached(store, 'k', 60, fn, opts);
    await cached(store, 'k', 60, fn, opts);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('MemoryCacheStore', () => {
  test('MemoryCacheStore hết hạn sau ttl', async () => {
    vi.useFakeTimers();
    const store = new MemoryCacheStore();
    await store.set('k', 'v', 10);
    expect(await store.get('k')).toBe('v');
    vi.advanceTimersByTime(11_000);
    expect(await store.get('k')).toBeNull();
  });

  test('incr đếm nguyên tử và decr giảm', async () => {
    const store = new MemoryCacheStore();
    await Promise.all([store.incr('c', 60), store.incr('c', 60), store.incr('c', 60)]);
    expect(await store.get<number>('c')).toBe(3);
    expect(await store.decr('c')).toBe(2);
  });
});
