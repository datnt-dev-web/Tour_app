import { describe, expect, test } from 'vitest';
import { nextThemePref, parseThemePref, THEME_INIT_SCRIPT } from '@/shared/ui/theme';

describe('theme', () => {
  test('nút chuyển vòng: hệ thống → sáng → tối → hệ thống', () => {
    expect(nextThemePref('system')).toBe('light');
    expect(nextThemePref('light')).toBe('dark');
    expect(nextThemePref('dark')).toBe('system');
  });
  test('giá trị lưu lạ hoặc thiếu coi là theo hệ thống', () => {
    expect(parseThemePref('dark')).toBe('dark');
    expect(parseThemePref(null)).toBe('system');
    expect(parseThemePref('blue')).toBe('system');
  });
  test('script đầu trang chỉ đặt data-theme khi người dùng đã chọn sáng/tối', () => {
    expect(THEME_INIT_SCRIPT).toContain('localStorage');
    expect(THEME_INIT_SCRIPT).toContain('data-theme');
  });
});
