import { describe, expect, test, vi } from 'vitest';
import { createOpenMeteoClient, describeWeather } from '@/integrations/open-meteo/client';

describe('describeWeather', () => {
  test('mã WMO → biểu tượng + chữ tiếng Việt', () => {
    expect(describeWeather(0)).toEqual({ icon: '☀️', label: 'Nắng' });
    expect(describeWeather(3).label).toBe('Nhiều mây');
    expect(describeWeather(61).label).toBe('Mưa');
    expect(describeWeather(95).label).toBe('Dông');
    expect(describeWeather(999).label).toBe('Không rõ');
  });
});

describe('createOpenMeteoClient.daily', () => {
  test('gọi theo tọa độ + khoảng ngày (giờ VN), trả từng ngày', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        daily: {
          time: ['2026-11-23', '2026-11-24'],
          weather_code: [61, 1],
          temperature_2m_max: [27.6, 29.1],
          temperature_2m_min: [21.2, 22],
          precipitation_probability_max: [80, null],
        },
      }),
    );
    const days = await createOpenMeteoClient({ fetchFn }).daily({ lat: 20.86, lng: 106.68 }, '2026-11-23', '2026-11-24');
    expect(days).toEqual([
      { date: '2026-11-23', code: 61, max: 28, min: 21, rainPct: 80 },
      { date: '2026-11-24', code: 1, max: 29, min: 22, rainPct: null },
    ]);
    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('timezone')).toBe('Asia/Ho_Chi_Minh');
    expect(url.searchParams.get('start_date')).toBe('2026-11-23');
  });

  test('lỗi mạng/HTTP → WEATHER_UNAVAILABLE', async () => {
    const client = createOpenMeteoClient({ fetchFn: vi.fn(async () => new Response('x', { status: 400 })) });
    await expect(client.daily({ lat: 1, lng: 2 }, '2026-11-23', '2026-11-24')).rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });
  });
});
