import { randomBytes } from 'node:crypto';
import type { CacheStore } from '@/shared/cache/cache-store';
import { AppError } from '@/shared/errors';
import { SHARE_TTL_DAYS } from '../constants';

const TOKEN_BYTES = 32;
/** base64url của 32 byte = 43 ký tự. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 86_400_000;
const RATE_WINDOW_SEC = 60;

export const generateShareToken = () => randomBytes(TOKEN_BYTES).toString('base64url');
export const shareExpiry = (now: Date = new Date()) => new Date(now.getTime() + SHARE_TTL_DAYS * DAY_MS);

type SharedTripRow = { id: string; share_expires_at: string | null };

/** Chuyến được chia sẻ bằng token (còn hạn) + các chỗ; null nếu token sai, không có hoặc hết hạn. */
export async function loadSharedTrip<T extends SharedTripRow, S>(
  deps: { findByToken: (token: string) => Promise<T | null>; listStops: (tripId: string) => Promise<S[]> },
  token: string,
  now: Date = new Date(),
): Promise<{ trip: T; stops: S[] } | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const trip = await deps.findByToken(token);
  if (!trip || !trip.share_expires_at || Date.parse(trip.share_expires_at) <= now.getTime()) return null;
  return { trip, stops: await deps.listStops(trip.id) };
}

/**
 * Link chia sẻ ai cũng mở được, nên mỗi link chỉ được tính quãng đường `limitPerMin` lần mỗi phút
 * (cửa sổ 60 giây tính từ lần đầu), tránh bị spam máy chủ định tuyến miễn phí.
 */
export async function consumeShareDistanceRate(store: Pick<CacheStore, 'incr'>, token: string, limitPerMin: number): Promise<void> {
  const count = await store.incr(`share:dist:${token}`, RATE_WINDOW_SEC);
  if (count > limitPerMin) throw new AppError('RATE_LIMITED', 'Bạn bấm hơi nhiều, đợi một phút rồi thử lại.');
}
