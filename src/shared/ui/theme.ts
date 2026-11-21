/** Lựa chọn giao diện: theo hệ thống (mặc định), luôn sáng, luôn tối. Lưu trên máy (localStorage). */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ft:theme';
const ORDER: ThemePref[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Record<ThemePref, string> = { system: 'Theo máy', light: 'Sáng', dark: 'Tối' };

export const nextThemePref = (p: ThemePref): ThemePref => ORDER[(ORDER.indexOf(p) + 1) % ORDER.length];

export const parseThemePref = (raw: string | null | undefined): ThemePref => (raw === 'light' || raw === 'dark' ? raw : 'system');

/** Áp lựa chọn lên <html>: "system" thì bỏ data-theme để CSS theo prefers-color-scheme. */
export function applyThemePref(p: ThemePref) {
  const el = document.documentElement;
  if (p === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', p);
}

/** Chạy trong <head> trước khi vẽ trang, để không nháy nền trắng khi người dùng đã chọn tối. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
