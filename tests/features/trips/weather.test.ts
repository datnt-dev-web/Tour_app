import { describe, expect, test, vi } from 'vitest';
import { forecastRange, tripWeather } from '@/features/trips/services/weather';
import { MemoryCacheStore } from '@/shared/cache/memory-store';

describe('forecastRange', () => {
  test('chỉ phần ngày chuyến nằm trong 16 ngày tới (tính cả hôm nay)', () => {
    expect(forecastRange({ start_date: '2026-11-23', end_date: '2026-11-24' }, '2026-11-21')).toEqual({ start: '2026-11-23', end: '2026-11-24' });
    expect(forecastRange({ start_date: '2026-11-20', end_date: '2026-11-24' }, '2026-11-22')).toEqual({ start: '2026-11-22', end: '2026-11-24' });
    expect(forecastRange({ start_date: '2026-11-30', end_date: '2026-12-20' }, '2026-11-21')).toEqual({ start: '2026-11-30', end: '2026-12-06' });
  });
  test('chuyến đã qua, quá xa hoặc chưa có ngày → null', () => {
    expect(forecastRange({ start_date: '2026-11-01', end_date: '2026-11-02' }, '2026-11-21')).toBeNull();
    expect(forecastRange({ start_date: '2027-01-10', end_date: '2027-01-11' }, '2026-11-21')).toBeNull();
    expect(forecastRange({ start_date: null, end_date: null }, '2026-11-21')).toBeNull();
  });
});

describe('tripWeather', () => {
  const deps = () => ({
    geocoder: { geocode: vi.fn(async () => ({ lat: 20.86, lng: 106.68 })) },
    weather: { daily: vi.fn(async () => [{ date: '2026-11-23', code: 61, max: 28, min: 21, rainPct: 80 }]) },
    cache: new MemoryCacheStore(),
  });
  const trip = { city: 'Hải Phòng', start_date: '2026-11-23', end_date: '2026-11-24' };

  test('lấy tọa độ thành phố rồi dự báo đúng khoảng; lần sau dùng cache', async () => {
    const d = deps();
    expect(await tripWeather(d, trip, '2026-11-21')).toHaveLength(1);
    await tripWeather(d, trip, '2026-11-21');
    expect(d.weather.daily).toHaveBeenCalledTimes(1);
    expect(d.weather.daily).toHaveBeenCalledWith({ lat: 20.86, lng: 106.68 }, '2026-11-23', '2026-11-24');
  });

  test('ngoài khoảng dự báo hoặc không định vị được thành phố → rỗng, không gọi thời tiết', async () => {
    const d = deps();
    expect(await tripWeather(d, { ...trip, start_date: '2027-01-01', end_date: '2027-01-02' }, '2026-11-21')).toEqual([]);
    d.geocoder.geocode.mockResolvedValueOnce(null as never);
    expect(await tripWeather(d, { ...trip, city: 'Xyz' }, '2026-11-21')).toEqual([]);
    expect(d.weather.daily).not.toHaveBeenCalled();
  });
});
