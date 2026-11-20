import { describe, expect, test } from 'vitest';
import type { BookPlaceRaw } from '@/features/places/repositories/places-repo';
import { listBook } from '@/features/places/services/book-service';

const raw = (id: string, name: string, over: Partial<BookPlaceRaw> = {}): BookPlaceRaw => ({
  id, group_id: 'G', google_place_id: null, name, city: 'Hải Phòng', city_norm: 'hai phong', address: 'Số 1 Lạch Tray',
  category: 'snack', maps_url: null, verified: true, created_by: null, place_reviews_internal: [], ...over,
});
const rev = (verdict: 'up' | 'down', created_at: string, note: string | null = null) => ({ verdict, note, created_at });

const data: BookPlaceRaw[] = [
  raw('a', 'Chè Hường', { place_reviews_internal: [rev('down', '2026-01-01T00:00:00Z', 'cũ'), rev('up', '2026-03-01T00:00:00Z', 'mới ngon')] }),
  raw('b', 'Bánh mì Cô Ba', { place_reviews_internal: [rev('up', '2026-01-01T00:00:00Z'), rev('down', '2026-02-01T00:00:00Z', 'dở')] }),
  raw('c', 'Cafe Gió', { address: 'Đường Điện Biên Phủ' }),
];
const repo = { listBookPlaces: async () => data };

describe('listBook', () => {
  test('lọc q không dấu: "che huong" khớp "Chè Hường"', async () => {
    const rows = await listBook(repo, 'G', { q: 'che huong' });
    expect(rows.map((r) => r.placeId)).toEqual(['a']);
  });

  test('q khớp địa chỉ và ghi chú', async () => {
    expect((await listBook(repo, 'G', { q: 'dien bien' })).map((r) => r.placeId)).toEqual(['c']);
    expect((await listBook(repo, 'G', { q: 'ngon' })).map((r) => r.placeId)).toEqual(['a']);
  });

  test('verdict theo đánh giá mới nhất', async () => {
    expect((await listBook(repo, 'G', { verdict: 'up' })).map((r) => r.placeId)).toEqual(['a']);
    expect((await listBook(repo, 'G', { verdict: 'down' })).map((r) => r.placeId)).toEqual(['b']);
    const all = await listBook(repo, 'G', {});
    expect(all.find((r) => r.placeId === 'a')).toMatchObject({ verdict: 'up', note: 'mới ngon' });
  });

  test("verdict 'none' là chỗ chưa có đánh giá nào", async () => {
    expect((await listBook(repo, 'G', { verdict: 'none' })).map((r) => r.placeId)).toEqual(['c']);
  });
});
