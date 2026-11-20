import 'server-only';
import type { LatLng } from '@/integrations/google-places/types';
import { AppError } from '@/shared/errors';

const BASE_URL = 'https://nominatim.openstreetmap.org/search';
// Chính sách Nominatim bắt buộc User-Agent định danh ứng dụng; cố ý chung chung, không chứa thông tin cá nhân.
const USER_AGENT = 'FoodTourNhom/1.0 (self-hosted group app)';
// Chính sách: tối đa 1 request/giây; chừa dư để không chạm ngưỡng.
export const MIN_GAP_MS = 1100;

export interface GeocodingClient {
  /** null khi OSM không có kết quả. */
  geocode(q: string): Promise<LatLng | null>;
}

export interface Throttle {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Xếp hàng tuần tự, hai lần bắt đầu cách nhau tối thiểu gapMs. Một tác vụ lỗi không chặn các tác vụ sau. */
export function createThrottle(gapMs: number = MIN_GAP_MS, clock: Clock = realClock): Throttle {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart = -Infinity;
  return {
    run(fn) {
      const p = tail.then(async () => {
        const wait = lastStart + gapMs - clock.now();
        if (wait > 0) await clock.sleep(wait);
        lastStart = clock.now();
        return fn();
      });
      tail = p.catch(() => undefined);
      return p;
    },
  };
}

// Hàng đợi dùng chung cả tiến trình: mọi client mặc định phải chung một nhịp 1 req/giây.
const sharedThrottle = createThrottle();

const unavailable = () => new AppError('GEOCODE_UNAVAILABLE', 'Không lấy được vị trí, thử lại sau.');

export function createNominatimClient(opts: { throttle?: Throttle } = {}): GeocodingClient {
  const throttle = opts.throttle ?? sharedThrottle;
  return {
    geocode: (q) =>
      throttle.run(async () => {
        const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'vn', 'accept-language': 'vi', q });
        let res: Response;
        try {
          res = await fetch(`${BASE_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
        } catch {
          throw unavailable();
        }
        if (!res.ok) throw unavailable();
        let data: { lat?: string; lon?: string }[];
        try {
          data = (await res.json()) as typeof data;
        } catch {
          throw unavailable();
        }
        if (!data[0]) return null;
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }),
  };
}
