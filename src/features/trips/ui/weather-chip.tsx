'use client';

import { queryOptions } from '@tanstack/react-query';
import { describeWeather, type DailyWeather } from '@/integrations/open-meteo/client';
import { queryKeys } from '@/shared/query/keys';
import { useQuery } from '@/shared/query/use-query';

const WEATHER_STALE_MS = 60 * 60 * 1000;

/** Thời tiết cả chuyến một lần; lỗi thì im lặng (chỉ là thông tin phụ). */
export const tripWeatherQuery = (tripId: string) =>
  queryOptions({
    queryKey: queryKeys.tripWeather(tripId),
    staleTime: WEATHER_STALE_MS,
    retry: false,
    queryFn: async (): Promise<DailyWeather[]> => {
      const res = await fetch(`/api/trips/${tripId}/weather`);
      if (!res.ok) return [];
      return ((await res.json()) as { days: DailyWeather[] }).days;
    },
  });

/** Ô nhỏ: biểu tượng, nhiệt độ thấp–cao, khả năng mưa. Không có dự báo cho ngày đó thì không hiện gì. */
export function WeatherChip({ tripId, date, className = '' }: { tripId: string; date: string; className?: string }) {
  const { data } = useQuery(tripWeatherQuery(tripId));
  const w = data?.find((d) => d.date === date);
  if (!w) return null;
  const { icon, label } = describeWeather(w.code);
  return (
    <span title={label} className={`inline-flex items-center gap-1 text-xs font-semibold normal-case tracking-normal tabular-nums ${className}`}>
      <span aria-hidden>{icon}</span>
      <span className="sr-only">{label}, </span>
      {w.min}–{w.max}°
      {w.rainPct !== null && w.rainPct >= 30 && <span>· 💧{w.rainPct}%</span>}
    </span>
  );
}
