import { beforeEach, describe, expect, test, vi } from 'vitest';
import { consumeAiQuota, getAiStatus, refundAiQuota } from '@/features/ai/services/quota';
import { MemoryCacheStore } from '@/shared/cache/memory-store';

const env = vi.hoisted(() => ({ AI_DAILY_LIMIT_PER_GROUP: 10, AI_MONTHLY_CAP: 300 }));
vi.mock('@/shared/config/env', () => ({ getEnv: () => env }));

const NOW = new Date('2026-11-20T05:00:00Z');
let store: MemoryCacheStore;
beforeEach(() => {
  env.AI_MONTHLY_CAP = 300;
  store = new MemoryCacheStore();
});

describe('consumeAiQuota', () => {
  test('lượt đầu còn 9', async () => {
    expect(await consumeAiQuota(store, 'G', NOW)).toEqual({ remainingToday: 9 });
  });

  test('lượt 11 trong ngày → AI_QUOTA, bộ đếm vẫn 10', async () => {
    for (let i = 0; i < 10; i++) await consumeAiQuota(store, 'G', NOW);
    await expect(consumeAiQuota(store, 'G', NOW)).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect(await store.get('ai:day:G:2026-11-20')).toBe(10);
    expect(await store.get('ai:month:2026-11')).toBe(10);
  });

  test('chạm AI_MONTHLY_CAP → AI_QUOTA dù ngày còn lượt', async () => {
    env.AI_MONTHLY_CAP = 2;
    await consumeAiQuota(store, 'A', NOW);
    await consumeAiQuota(store, 'B', NOW);
    await expect(consumeAiQuota(store, 'C', NOW)).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect(await store.get('ai:day:C:2026-11-20')).toBe(0);
    expect(await store.get('ai:month:2026-11')).toBe(2);
  });

  test('ngày quota theo giờ VN: 23:30 UTC ngày 20/11 tính vào 21/11', async () => {
    await consumeAiQuota(store, 'G', new Date('2026-11-20T23:30:00Z'));
    expect(await store.get('ai:day:G:2026-11-21')).toBe(1);
    expect(await store.get('ai:day:G:2026-11-20')).toBeNull();
  });
});

describe('refundAiQuota / getAiStatus', () => {
  test('hoàn lượt trả bộ đếm về trước đó', async () => {
    await consumeAiQuota(store, 'G', NOW);
    await refundAiQuota(store, 'G', NOW);
    expect(await getAiStatus(store, 'G', NOW)).toEqual({ remainingToday: 10, dailyLimit: 10, monthlyCapReached: false });
  });

  test('status báo chạm trần tháng', async () => {
    env.AI_MONTHLY_CAP = 1;
    await consumeAiQuota(store, 'G', NOW);
    expect(await getAiStatus(store, 'G', NOW)).toMatchObject({ remainingToday: 9, monthlyCapReached: true });
  });
});
