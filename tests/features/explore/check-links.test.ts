import { expect, test } from 'vitest';
import { buildCheckLinks } from '@/features/explore/services/check-links';

test('buildCheckLinks mã hóa tiếng Việt', () => {
  const links = buildCheckLinks('Chè Hường', 'Hải Phòng');
  expect(links.threads).toBe('https://www.threads.net/search?q=Ch%C3%A8%20H%C6%B0%E1%BB%9Dng%20H%E1%BA%A3i%20Ph%C3%B2ng');
  expect(links.tiktok).toBe('https://www.tiktok.com/search?q=Ch%C3%A8%20H%C6%B0%E1%BB%9Dng%20H%E1%BA%A3i%20Ph%C3%B2ng');
  expect(links.maps).toBe('https://www.google.com/maps/search/?api=1&query=Ch%C3%A8%20H%C6%B0%E1%BB%9Dng%20H%E1%BA%A3i%20Ph%C3%B2ng');
  expect(links.google).toBe('https://www.google.com/search?q=Ch%C3%A8%20H%C6%B0%E1%BB%9Dng%20H%E1%BA%A3i%20Ph%C3%B2ng%20review');
});
