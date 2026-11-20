import { expect, test } from 'vitest';
import { buildExploreQuery, readParams } from '@/features/explore/ui/explore-params';

test('patch city giữ nguyên category và price hiện tại', () => {
  const current = readParams(new URLSearchParams('city=Hà Nội&category=cafe&price=2'));
  expect(buildExploreQuery(current, { city: 'Hải Phòng' })).toBe('city=H%E1%BA%A3i+Ph%C3%B2ng&category=cafe&price=2');
});

test('patch price undefined bỏ lọc giá; category mặc định food', () => {
  const current = readParams(new URLSearchParams('city=x&price=3'));
  expect(current.category).toBe('food');
  expect(buildExploreQuery(current, { price: undefined })).toBe('city=x&category=food');
});
