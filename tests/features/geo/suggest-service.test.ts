import { describe, expect, test, vi } from 'vitest';
import { suggestPlaces } from '@/features/geo/services/suggest-service';
import { MemoryCacheStore } from '@/shared/cache/memory-store';

const s = (name: string, city: string | null) => ({ label: `${name}, ${city}`, name, city });

function deps(results = [s('Lạch Tray', 'Hà Nội'), s('Lạch Tray', 'Hải Phòng'), s('Lạch Tray 2', 'Hải Phòng')]) {
  const client = { suggest: vi.fn(async () => results) };
  return { client, cache: new MemoryCacheStore(), ttlSec: 60 };
}

describe('suggestPlaces', () => {
  test('gõ dưới 2 ký tự thì không gọi', async () => {
    const d = deps();
    expect(await suggestPlaces(d, { q: ' a ', kind: 'address' })).toEqual([]);
    expect(d.client.suggest).not.toHaveBeenCalled();
  });
  test('địa chỉ trong thành phố của chuyến lên đầu (không phân biệt dấu)', async () => {
    const r = await suggestPlaces(deps(), { q: 'lach tray', kind: 'address', city: 'hai phong' });
    expect(r.map((x) => x.city)).toEqual(['Hải Phòng', 'Hải Phòng', 'Hà Nội']);
  });
  test('cache theo truy vấn đã chuẩn hóa: gõ lại có dấu/khoảng trắng không gọi thêm', async () => {
    const d = deps();
    await suggestPlaces(d, { q: 'Lạch Tray', kind: 'address' });
    await suggestPlaces(d, { q: ' lach  tray ', kind: 'address', city: 'Hải Phòng' });
    expect(d.client.suggest).toHaveBeenCalledTimes(1);
  });
});
