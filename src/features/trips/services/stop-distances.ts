import type { RoutingClient } from '@/integrations/valhalla/client';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cached } from '@/shared/cache/cached';
import { cacheKey } from '@/shared/cache/keys';
import { AppError } from '@/shared/errors';
import { NEARBY_LIMIT, NEARBY_MAX_M } from '../constants';
import { distanceMeters, type LatLng } from './geo';

export interface StopPoint extends LatLng {
  id: string;
}

export interface StopDistances {
  /** 'road' = quãng đường đi thật; 'straight' = đường thẳng (máy chủ định tuyến đang lỗi). */
  mode: 'road' | 'straight';
  /** Mét từ vị trí của mình tới từng chỗ; thiếu khóa = không biết (chưa bật vị trí, hoặc không có đường). */
  fromMe: Record<string, number>;
  /** Các chỗ khác trong ngưỡng "gần", gần nhất trước. */
  nearby: Record<string, { id: string; meters: number }[]>;
}

export interface StopDistancesDeps {
  routing: RoutingClient;
  cache: CacheStore;
  ttlSec: number;
  /** Đưa vào khóa cache: đổi phương tiện thì không dùng nhầm quãng đường cũ. */
  costing: string;
}

const straightMatrix = (sources: LatLng[], targets: LatLng[]) => sources.map((s) => targets.map((t) => Math.round(distanceMeters(s, t))));

/** Từ ma trận quãng đường giữa các chỗ: mỗi chỗ lấy các chỗ khác trong ngưỡng, gần nhất trước. */
export function nearbyFromMatrix(points: StopPoint[], matrix: (number | null)[][], maxM = NEARBY_MAX_M, limit = NEARBY_LIMIT): StopDistances['nearby'] {
  return Object.fromEntries(
    points.map((p, i) => [
      p.id,
      points
        .flatMap((q, j) => {
          const m = matrix[i]?.[j];
          return j !== i && typeof m === 'number' && m <= maxM ? [{ id: q.id, meters: m }] : [];
        })
        .sort((a, b) => a.meters - b.meters)
        .slice(0, limit),
    ]),
  );
}

const fromRow = (points: StopPoint[], row: (number | null)[] | undefined) =>
  Object.fromEntries(points.flatMap((p, i) => (typeof row?.[i] === 'number' ? [[p.id, row[i]]] : [])));

/**
 * Quãng đường đi thật (Valhalla) từ vị trí của mình tới các chỗ, và giữa các chỗ với nhau.
 * Cache theo tọa độ (vị trí của mình đã làm tròn ô lưới ở client). Máy chủ định tuyến lỗi thì trả đường thẳng, ghi rõ mode.
 */
export async function getStopDistances(deps: StopDistancesDeps, input: StopPoint[], origin: LatLng | null): Promise<StopDistances> {
  const points = [...input].sort((a, b) => a.id.localeCompare(b.id));
  if (points.length === 0) return { mode: 'road', fromMe: {}, nearby: {} };
  const pts = points.map((p) => `${p.id}@${p.lat},${p.lng}`).join(';');
  try {
    const between = await cached(deps.cache, cacheKey('route:between', { c: deps.costing, pts }), deps.ttlSec, () =>
      deps.routing.distanceMatrix(points, points),
    );
    const fromMe = origin
      ? await cached(deps.cache, cacheKey('route:from', { c: deps.costing, o: `${origin.lat},${origin.lng}`, pts }), deps.ttlSec, async () =>
          (await deps.routing.distanceMatrix([origin], points))[0] ?? [],
        )
      : [];
    return { mode: 'road', fromMe: fromRow(points, fromMe), nearby: nearbyFromMatrix(points, between) };
  } catch (e) {
    if (!(e instanceof AppError && e.code === 'ROUTING_UNAVAILABLE')) throw e;
    return {
      mode: 'straight',
      fromMe: origin ? fromRow(points, straightMatrix([origin], points)[0]) : {},
      nearby: nearbyFromMatrix(points, straightMatrix(points, points)),
    };
  }
}
