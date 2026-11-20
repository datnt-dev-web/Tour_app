import { describe, expect, test } from 'vitest';
import { isPublicPath } from '@/shared/supabase/public-paths';

describe('isPublicPath', () => {
  test.each([
    ['/login', true],
    ['/auth/callback', true],
    ['/invite/abc', true],
    ['/', false],
    ['/explore', false],
    ['/invitex', false],
  ])('%s -> %s', (path, expected) => expect(isPublicPath(path)).toBe(expected));
});
