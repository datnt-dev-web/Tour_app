import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/shared/config/env', () => ({ getEnv: () => ({}) }));

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

test('getCacheStore trả singleton MemoryCacheStore khi thiếu Upstash env', async () => {
  const { getCacheStore } = await import('@/shared/cache/get-cache-store');
  const { MemoryCacheStore } = await import('@/shared/cache/memory-store');
  const a = getCacheStore();
  expect(a).toBeInstanceOf(MemoryCacheStore);
  expect(getCacheStore()).toBe(a);
});

test('getCacheStore throw CACHE_NOT_CONFIGURED ở production khi thiếu Upstash env', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const { getCacheStore } = await import('@/shared/cache/get-cache-store');
  expect(() => getCacheStore()).toThrow(expect.objectContaining({ code: 'CACHE_NOT_CONFIGURED' }));
});
