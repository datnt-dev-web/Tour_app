import { describe, expect, it } from 'vitest';
import { isTabActive } from './bottom-nav';

describe('isTabActive', () => {
  it('Chuyến đi active ở / và /trips/*', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/trips/abc')).toBe(true);
    expect(isTabActive('/', '/explore')).toBe(false);
  });
  it('các tab khác theo tiền tố', () => {
    expect(isTabActive('/explore', '/explore')).toBe(true);
    expect(isTabActive('/book', '/explore')).toBe(false);
  });
});
