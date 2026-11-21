import { FORECAST_DAYS_MAX, type DailyWeather, type WeatherClient } from '@/integrations/open-meteo/client';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cached } from '@/shared/cache/cached';
import { cacheKey } from '@/shared/cache/keys';
import { normalizeText } from '@/shared/text';
import type { Trip } from '../repositories/trips-repo';

/** Dự báo đổi vài lần mỗi ngày: cache 3 giờ. */
export const WEATHER_TTL_SEC = 3 * 3600;
/** Tọa độ thành phố gần như không đổi. */
const CITY_TTL_SEC = 30 * 86_400;
const DAY_MS = 86_400_000;

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Phần ngày của chuyến nằm trong khả năng dự báo (hôm nay → 16 ngày tới); null nếu không còn ngày nào. */
export function forecastRange(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): { start: string; end: string } | null {
  if (!trip.start_date) return null;
  const start = trip.start_date > today ? trip.start_date : today;
  const last = addDays(today, FORECAST_DAYS_MAX - 1);
  const tripEnd = trip.end_date ?? trip.start_date;
  const end = tripEnd < last ? tripEnd : last;
  return start <= end ? { start, end } : null;
}

export interface WeatherDeps {
  geocoder: { geocode(q: string): Promise<{ lat: number; lng: number } | null> };
  weather: WeatherClient;
  cache: CacheStore;
}

/** Thời tiết từng ngày của chuyến (trong khoảng dự báo được); rỗng khi không có gì để hiện. */
export async function tripWeather(deps: WeatherDeps, trip: Pick<Trip, 'city' | 'start_date' | 'end_date'>, today: string): Promise<DailyWeather[]> {
  const range = forecastRange(trip, today);
  if (!range) return [];
  const q = `${trip.city.trim()}, Việt Nam`;
  const at = await cached(deps.cache, cacheKey('explore:city', { q: normalizeText(q) }), CITY_TTL_SEC, () => deps.geocoder.geocode(q));
  if (!at) return [];
  return cached(deps.cache, cacheKey('weather:daily', { lat: at.lat.toFixed(2), lng: at.lng.toFixed(2), s: range.start, e: range.end }), WEATHER_TTL_SEC, () =>
    deps.weather.daily(at, range.start, range.end),
  );
}
