import { expect, test } from 'vitest';
import { buildExploreQuery, readParams, syncCityFromUrl } from '@/features/explore/ui/explore-params';

test('patch city giữ nguyên category và price hiện tại', () => {
  const current = readParams(new URLSearchParams('city=Hà Nội&category=cafe&price=2'));
  expect(buildExploreQuery(current, { city: 'Hải Phòng' })).toBe('city=H%E1%BA%A3i+Ph%C3%B2ng&category=cafe&price=2');
});

test('patch price undefined bỏ lọc giá; category mặc định food', () => {
  const current = readParams(new URLSearchParams('city=x&price=3'));
  expect(current.category).toBe('food');
  expect(buildExploreQuery(current, { price: undefined })).toBe('city=x&category=food');
});

test('syncCityFromUrl: Back/Forward về city từng đẩy vẫn đồng bộ ô nhập', () => {
  let pushed = 'Hue'; // người dùng gõ Hue, ta đẩy lên URL
  // URL tới trễ đúng giá trị ta đẩy: giữ ô nhập
  expect(syncCityFromUrl('Hue', pushed)).toEqual({ input: null, pushed: 'Hue' });
  // Back -> Hanoi: đồng bộ và đổi mốc
  let r = syncCityFromUrl('Hanoi', pushed);
  expect(r).toEqual({ input: 'Hanoi', pushed: 'Hanoi' });
  pushed = r.pushed;
  // Forward -> Hue: phải đồng bộ
  r = syncCityFromUrl('Hue', pushed);
  expect(r).toEqual({ input: 'Hue', pushed: 'Hue' });
});
