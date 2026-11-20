import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/shared/config/env', () => ({ getEnv: () => ({}) }));

beforeEach(() => vi.resetModules());

test('getCacheStore trả singleton MemoryCacheStore khi thiếu Upstash env', async () => {
  const { getCacheStore } = await import('@/shared/cache/get-cache-store');
  const { MemoryCacheStore } = await import('@/shared/cache/memory-store');
  const a = getCacheStore();
  expect(a).toBeInstanceOf(MemoryCacheStore);
  expect(getCacheStore()).toBe(a);
});
