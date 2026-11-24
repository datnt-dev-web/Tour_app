import { describe, expect, test, vi } from 'vitest';
import { snapToGrid } from '@/features/trips/services/geo';
import { getStopDistances, nearbyFromMatrix, type StopPoint } from '@/features/trips/services/stop-distances';
import { MemoryCacheStore } from '@/shared/cache/memory-store';
import { AppError } from '@/shared/errors';

const A: StopPoint = { id: 'a', lat: 20.85, lng: 106.68 };
const B: StopPoint = { id: 'b', lat: 20.851, lng: 106.681 };
const C: StopPoint = { id: 'c', lat: 20.9, lng: 106.75 };
const ME = { lat: 20.84, lng: 106.67 };

function setup(matrix = vi.fn(async (s: unknown[], t: unknown[]) => s.map((src, i) => t.map((dst, j) => (src === dst ? 0 : 500 + i * 100 + j * 10))))) {
  return { deps: { routing: { distanceMatrix: matrix }, cache: new MemoryCacheStore(), ttlSec: 60, costing: 'motor_scooter' }, matrix };
}

describe('nearbyFromMatrix', () => {
  test('chỉ lấy chỗ khác trong ngưỡng, gần nhất trước, tối đa limit', () => {
    const m = [
      [0, 800, 300, 2000],
      [800, 0, 900, null],
      [300, 900, 0, 950],
      [2000, null, 950, 0],
    ];
    const pts = [A, B, C, { id: 'd', lat: 0, lng: 0 }];
    expect(nearbyFromMatrix(pts, m, 1000, 2)).toEqual({
      a: [{ id: 'c', meters: 300 }, { id: 'b', meters: 800 }],
      b: [{ id: 'a', meters: 800 }, { id: 'c', meters: 900 }],
      c: [{ id: 'a', meters: 300 }, { id: 'b', meters: 900 }],
      d: [{ id: 'c', meters: 950 }],
    });
  });
});

describe('getStopDistances', () => {
  test('quãng đường đi thật từ vị trí mình và giữa các chỗ; gọi lại thì dùng cache', async () => {
    const { deps, matrix } = setup();
    const r = await getStopDistances(deps, [B, A], ME);
    expect(r.mode).toBe('road');
    expect(r.fromMe).toEqual({ a: 500, b: 510 });
    expect(r.nearby).toEqual({ a: [{ id: 'b', meters: 510 }], b: [{ id: 'a', meters: 600 }] });
    await getStopDistances(deps, [A, B], ME);
    expect(matrix).toHaveBeenCalledTimes(2);
  });

  test('chưa bật vị trí: chỉ tính giữa các chỗ', async () => {
    const { deps, matrix } = setup();
    const r = await getStopDistances(deps, [A, B], null);
    expect(r.fromMe).toEqual({});
    expect(matrix).toHaveBeenCalledTimes(1);
  });

  test('máy chủ định tuyến lỗi: đường thẳng, ghi rõ mode straight', async () => {
    const { deps } = setup(vi.fn(async () => Promise.reject(new AppError('ROUTING_UNAVAILABLE', 'x'))));
    const r = await getStopDistances(deps, [A, B, C], ME);
    expect(r.mode).toBe('straight');
    expect(Object.keys(r.fromMe).sort()).toEqual(['a', 'b', 'c']);
    expect(r.nearby.a.map((n) => n.id)).toEqual(['b']);
  });

  test('lỗi lạ không bị nuốt', async () => {
    const { deps } = setup(vi.fn(async () => Promise.reject(new Error('boom'))));
    await expect(getStopDistances(deps, [A], ME)).rejects.toThrow('boom');
  });
});

describe('snapToGrid', () => {
  test('làm tròn về ô lưới, đi trong ô thì không đổi', () => {
    expect(snapToGrid({ lat: 20.85612, lng: 106.68219 }, 0.002)).toEqual({ lat: 20.856, lng: 106.682 });
    expect(snapToGrid({ lat: 20.85641, lng: 106.68281 }, 0.002)).toEqual({ lat: 20.856, lng: 106.682 });
  });
});
