import { AppError } from '@/shared/errors';

/** Open-Meteo: dự báo thời tiết theo ngày, miễn phí, không cần khóa. Dự báo tối đa 16 ngày tới. */
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS_MAX = 16;

export interface DailyWeather {
  date: string;
  /** Mã thời tiết WMO. */
  code: number;
  max: number;
  min: number;
  /** Khả năng mưa cao nhất trong ngày (%), null nếu không có số liệu. */
  rainPct: number | null;
}

/** Nhóm mã WMO → biểu tượng + chữ. Dùng được cả ở client (không có khóa hay gọi mạng). */
export function describeWeather(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Nắng' };
  if (code <= 2) return { icon: '🌤️', label: 'Ít mây' };
  if (code === 3) return { icon: '☁️', label: 'Nhiều mây' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Sương mù' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Mưa phùn' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: 'Mưa' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: 'Tuyết' };
  if (code >= 95 && code <= 99) return { icon: '⛈️', label: 'Dông' };
  return { icon: '🌡️', label: 'Không rõ' };
}

interface DailyResponse {
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
}

export interface WeatherClient {
  daily(at: { lat: number; lng: number }, startDate: string, endDate: string): Promise<DailyWeather[]>;
}

const unavailable = () => new AppError('WEATHER_UNAVAILABLE', 'Không tải được thời tiết, thử lại sau.');

export function createOpenMeteoClient(opts: { fetchFn?: typeof fetch } = {}): WeatherClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async daily(at, startDate, endDate) {
      const qs = new URLSearchParams({
        latitude: String(at.lat),
        longitude: String(at.lng),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'Asia/Ho_Chi_Minh',
        start_date: startDate,
        end_date: endDate,
      });
      let res: Response;
      try {
        res = await fetchFn(`${BASE_URL}?${qs}`);
      } catch {
        throw unavailable();
      }
      if (!res.ok) throw unavailable();
      const d = ((await res.json().catch(() => ({}))) as DailyResponse).daily;
      if (!d) throw unavailable();
      return d.time.map((date, i) => ({
        date,
        code: d.weather_code[i],
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        rainPct: d.precipitation_probability_max[i] ?? null,
      }));
    },
  };
}
