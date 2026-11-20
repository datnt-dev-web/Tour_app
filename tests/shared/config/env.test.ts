import { describe, expect, test } from 'vitest';
import { isGooglePlacesConfigured, parseEnv } from '@/shared/config/env';

const validEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GOOGLE_PLACES_API_KEY: 'places',
  GEMINI_API_KEY: 'gemini',
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  BOOTSTRAP_OWNER_EMAILS: 'a@x.com, b@x.com',
};

describe('parseEnv', () => {
  test('env thiếu GOOGLE_PLACES_API_KEY thì throw', () => {
    expect(() => parseEnv({ ...validEnv, GOOGLE_PLACES_API_KEY: undefined })).toThrow(/GOOGLE_PLACES_API_KEY/);
  });
  test('env áp mặc định số', () => {
    const e = parseEnv(validEnv);
    expect(e.AI_DAILY_LIMIT_PER_GROUP).toBe(10);
    expect(e.AI_MONTHLY_CAP).toBe(300);
    expect(e.RANK_PRIOR_M).toBe(50);
    expect(e.EXPLORE_MIN_REVIEWS).toBe(20);
    expect(e.PLACES_TTL_SEC).toBe(86400);
    expect(e.AI_SUMMARY_TTL_SEC).toBe(1209600);
    expect(e.AI_HOT_TTL_SEC).toBe(604800);
    expect(e.GEMINI_MODEL).toBe('gemini-2.5-flash');
  });
  test('đọc số từ chuỗi và tách danh sách email', () => {
    const e = parseEnv({ ...validEnv, AI_DAILY_LIMIT_PER_GROUP: '3' });
    expect(e.AI_DAILY_LIMIT_PER_GROUP).toBe(3);
    expect(e.BOOTSTRAP_OWNER_EMAILS).toEqual(['a@x.com', 'b@x.com']);
  });
  test('Upstash là tùy chọn (dev)', () => {
    const e = parseEnv({ ...validEnv, UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined });
    expect(e.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(e.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });
});

describe('isGooglePlacesConfigured', () => {
  test('khóa thật là true; thiếu hoặc giá trị giữ chỗ là false', () => {
    expect(isGooglePlacesConfigured('AIzaSyReal')).toBe(true);
    expect(isGooglePlacesConfigured(undefined)).toBe(false);
    expect(isGooglePlacesConfigured('')).toBe(false);
    expect(isGooglePlacesConfigured('your-google-places-key')).toBe(false);
    expect(isGooglePlacesConfigured('dummy-local')).toBe(false);
  });
});
