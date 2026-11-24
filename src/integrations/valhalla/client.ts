import 'server-only';
import type { LatLng } from '@/integrations/google-places/types';
import { AppError } from '@/shared/errors';

// Máy chủ công khai của FOSSGIS yêu cầu dùng có chừng mực; User-Agent cố ý chung chung, không chứa thông tin cá nhân.
const USER_AGENT = 'FoodTourNhom/1.0 (self-hosted group app)';
const KM_TO_M = 1000;

/** Kiểu phương tiện của Valhalla dùng để tính đường (vd. motor_scooter = xe máy). */
export type RoutingCosting = 'motor_scooter' | 'motorcycle' | 'auto' | 'pedestrian' | 'bicycle';

export interface RoutingClient {
  /** Quãng đường đi thật (mét) từ mỗi điểm đi tới mỗi điểm đến; null khi không có đường. */
  distanceMatrix(sources: LatLng[], targets: LatLng[]): Promise<(number | null)[][]>;
}

interface RawCell {
  from_index: number;
  to_index: number;
  distance: number | null;
}

const unavailable = () => new AppError('ROUTING_UNAVAILABLE', 'Không tính được quãng đường, thử lại sau.');

/** Valhalla (OpenStreetMap): ma trận quãng đường qua /sources_to_targets. */
export function createValhallaClient(baseUrl: string, costing: RoutingCosting): RoutingClient {
  return {
    async distanceMatrix(sources, targets) {
      if (sources.length === 0 || targets.length === 0) return sources.map(() => []);
      const toPoint = (p: LatLng) => ({ lat: p.lat, lon: p.lng });
      let res: Response;
      try {
        res = await fetch(`${baseUrl.replace(/\/$/, '')}/sources_to_targets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
          body: JSON.stringify({ sources: sources.map(toPoint), targets: targets.map(toPoint), costing, units: 'kilometers' }),
        });
      } catch {
        throw unavailable();
      }
      if (!res.ok) throw unavailable();
      let data: { sources_to_targets?: RawCell[][] };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw unavailable();
      }
      const out: (number | null)[][] = sources.map(() => targets.map(() => null));
      for (const row of data.sources_to_targets ?? []) {
        for (const cell of row) {
          if (out[cell.from_index] && cell.to_index < targets.length && typeof cell.distance === 'number') {
            out[cell.from_index][cell.to_index] = Math.round(cell.distance * KM_TO_M);
          }
        }
      }
      return out;
    },
  };
}
