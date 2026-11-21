import { describe, expect, test, vi } from 'vitest';
import { generateShareToken, loadSharedTrip, SHARE_TTL_DAYS, shareExpiry } from '@/features/trips/services/share';

describe('share token', () => {
  test('ngẫu nhiên, an toàn cho URL, đủ dài để không đoán được', () => {
    const a = generateShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(generateShareToken()).not.toBe(a);
  });

  test(`hết hạn sau ${SHARE_TTL_DAYS} ngày`, () => {
    expect(shareExpiry(new Date('2026-11-21T00:00:00Z')).toISOString()).toBe('2026-12-21T00:00:00.000Z');
  });
});

describe('loadSharedTrip', () => {
  const now = new Date('2026-11-21T00:00:00Z');
  const trip = { id: 't1', name: 'HP', city: 'Hải Phòng', start_date: '2026-11-23', end_date: '2026-11-24', share_expires_at: '2026-12-01T00:00:00Z' };
  const deps = (found: typeof trip | null = trip) => ({
    findByToken: vi.fn(async () => found),
    listStops: vi.fn(async () => [{ id: 's1' }]),
  });

  test('token hợp lệ, còn hạn → chuyến + chỗ', async () => {
    const d = deps();
    expect(await loadSharedTrip(d, 'x'.repeat(43), now)).toEqual({ trip, stops: [{ id: 's1' }] });
    expect(d.listStops).toHaveBeenCalledWith('t1');
  });

  test('token sai định dạng, không có, hoặc hết hạn → null (không gọi DB khi token sai định dạng)', async () => {
    const d = deps();
    expect(await loadSharedTrip(d, 'ngắn', now)).toBeNull();
    expect(d.findByToken).not.toHaveBeenCalled();
    expect(await loadSharedTrip(deps(null), 'x'.repeat(43), now)).toBeNull();
    expect(await loadSharedTrip(deps({ ...trip, share_expires_at: '2026-11-20T00:00:00Z' }), 'x'.repeat(43), now)).toBeNull();
  });
});
