import { normalizeText } from '@/shared/text';

/** Khóa cache ổn định: chuẩn hóa chuỗi, sắp khóa theo chữ cái, dạng `ns:k1=v1|k2=v2`. */
export function cacheKey(ns: string, parts: Record<string, string | number | undefined>): string {
  const body = Object.keys(parts)
    .filter((k) => parts[k] !== undefined)
    .sort()
    .map((k) => {
      const v = parts[k] as string | number;
      return `${k}=${typeof v === 'string' ? normalizeText(v) : v}`;
    })
    .join('|');
  return `${ns}:${body}`;
}
