import { afterEach, describe, expect, test, vi } from 'vitest';
import { createPhotonClient, toSuggestion } from '@/integrations/photon/client';
import { AppError } from '@/shared/errors';

afterEach(() => vi.unstubAllGlobals());

const vn = (p: Record<string, string>) => ({ properties: { countrycode: 'VN', ...p } });

describe('toSuggestion', () => {
  test('địa chỉ: tên, phố, quận, thành phố; bỏ phần trùng', () => {
    expect(toSuggestion(vn({ name: 'Phố Cầu Đất', street: 'Phố Cầu Đất', district: 'Gia Viên', city: 'Hải Phòng' }), 'address')).toEqual({
      label: 'Phố Cầu Đất, Gia Viên, Hải Phòng',
      name: 'Phố Cầu Đất',
      city: 'Hải Phòng',
    });
  });
  test('địa chỉ có số nhà nhưng không có tên thì lấy "số + phố"', () => {
    expect(toSuggestion(vn({ housenumber: '92', street: 'Trần Nhật Duật', city: 'Hải Phòng' }), 'address')).toMatchObject({
      name: '92 Trần Nhật Duật',
      label: '92 Trần Nhật Duật, Hải Phòng',
    });
  });
  test('thành phố: tên kèm tỉnh', () => {
    expect(toSuggestion(vn({ name: 'Duyên Hải', state: 'Vĩnh Long' }), 'city')).toEqual({ label: 'Duyên Hải, Vĩnh Long', name: 'Duyên Hải', city: 'Duyên Hải' });
  });
  test('ngoài Việt Nam hoặc không có tên thì bỏ', () => {
    expect(toSuggestion({ properties: { countrycode: 'TH', name: 'x' } }, 'city')).toBeNull();
    expect(toSuggestion(vn({ city: 'Hải Phòng' }), 'address')).toBeNull();
  });
});

describe('createPhotonClient', () => {
  test('gửi khung VN, lớp city/state khi tìm thành phố; bỏ kết quả trùng', async () => {
    const body = { features: [vn({ name: 'Hải Phòng' }), vn({ name: 'Hải Phòng' }), { properties: { countrycode: 'TH', name: 'x' } }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createPhotonClient().suggest('hai ph', 'city')).toEqual([{ label: 'Hải Phòng', name: 'Hải Phòng', city: 'Hải Phòng' }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('q')).toBe('hai ph');
    expect(url.searchParams.get('bbox')).toBe('102.1,8.2,109.5,23.4');
    expect(url.searchParams.getAll('layer')).toEqual(['city', 'state']);
  });
  test('lỗi mạng hoặc HTTP → GEO_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    await expect(createPhotonClient().suggest('abc', 'address')).rejects.toBeInstanceOf(AppError);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(createPhotonClient().suggest('abc', 'address')).rejects.toMatchObject({ code: 'GEO_UNAVAILABLE' });
  });
});
