import type { CacheStore } from '@/shared/cache/cache-store';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { todayInVietnam } from '@/shared/date';

const DAY_TTL_SEC = 2 * 86_400;
const MONTH_TTL_SEC = 40 * 86_400;

export const QUOTA_MESSAGE = 'Hôm nay nhóm đã dùng hết lượt AI.';

export interface AiStatus {
  remainingToday: number;
  dailyLimit: number;
  monthlyCapReached: boolean;
}

/** Ngày/tháng quota tính theo giờ VN để lượt reset lúc 0h sáng Việt Nam. */
function keys(groupId: string, now: Date) {
  const day = todayInVietnam(now);
  return { day: `ai:day:${groupId}:${day}`, month: `ai:month:${day.slice(0, 7)}` };
}

/** Trừ 1 lượt của nhóm và 1 lượt của tháng; vượt trần thì hoàn cả hai rồi ném AI_QUOTA. */
export async function consumeAiQuota(store: CacheStore, groupId: string, now: Date): Promise<{ remainingToday: number }> {
  const env = getEnv();
  const k = keys(groupId, now);
  const day = await store.incr(k.day, DAY_TTL_SEC);
  const month = await store.incr(k.month, MONTH_TTL_SEC);
  if (day > env.AI_DAILY_LIMIT_PER_GROUP || month > env.AI_MONTHLY_CAP) {
    await Promise.all([store.decr(k.day), store.decr(k.month)]);
    throw new AppError('AI_QUOTA', QUOTA_MESSAGE);
  }
  return { remainingToday: env.AI_DAILY_LIMIT_PER_GROUP - day };
}

export async function refundAiQuota(store: CacheStore, groupId: string, now: Date): Promise<void> {
  const k = keys(groupId, now);
  await Promise.all([store.decr(k.day), store.decr(k.month)]);
}

export async function getAiStatus(store: CacheStore, groupId: string, now: Date = new Date()): Promise<AiStatus> {
  const env = getEnv();
  const k = keys(groupId, now);
  const [day, month] = await Promise.all([store.get<number>(k.day), store.get<number>(k.month)]);
  return {
    remainingToday: Math.max(0, env.AI_DAILY_LIMIT_PER_GROUP - Number(day ?? 0)),
    dailyLimit: env.AI_DAILY_LIMIT_PER_GROUP,
    monthlyCapReached: Number(month ?? 0) >= env.AI_MONTHLY_CAP,
  };
}
