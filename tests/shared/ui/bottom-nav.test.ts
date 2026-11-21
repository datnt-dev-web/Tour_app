import { describe, expect, it } from 'vitest';
import { isTabActive, NAV_TABS } from '@/shared/ui/bottom-nav';

describe('isTabActive', () => {
  it('Chuyến đi active ở / và /trips/*', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/trips/abc')).toBe(true);
    expect(isTabActive('/', '/explore')).toBe(false);
  });
  it('bản đồ chuyến thuộc tab Bản đồ, không thuộc Chuyến đi', () => {
    expect(isTabActive('/map', '/map')).toBe(true);
    expect(isTabActive('/map', '/trips/abc', 'map')).toBe(true);
    expect(isTabActive('/', '/trips/abc', 'map')).toBe(false);
    expect(isTabActive('/map', '/trips/abc', null)).toBe(false);
    expect(isTabActive('/', '/trips/abc', 'list')).toBe(true);
  });
  it('các tab khác theo tiền tố', () => {
    expect(isTabActive('/explore', '/explore')).toBe(true);
    expect(isTabActive('/book', '/explore')).toBe(false);
  });

  it('tab Thông tin sáng ở /info (kể cả khi chọn chuyến), không làm sáng tab Chuyến đi', () => {
    expect(isTabActive('/info', '/info')).toBe(true);
    expect(isTabActive('/', '/info')).toBe(false);
  });
  it('thanh dưới có tab Thông tin', () => {
    expect(NAV_TABS.map((t) => t.href)).toContain('/info');
  });
});
