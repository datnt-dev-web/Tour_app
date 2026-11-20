import { describe, expect, test } from 'vitest';
import { isApiPath, isPublicPath } from '@/shared/supabase/public-paths';

describe('isPublicPath', () => {
  test.each([
    ['/login', true],
    ['/auth/callback', true],
    ['/invite/abc', true],
    ['/sw.js', true],
    ['/manifest.webmanifest', true],
    ['/', false],
    ['/explore', false],
    ['/invitex', false],
  ])('%s -> %s', (path, expected) => expect(isPublicPath(path)).toBe(expected));
});

describe('isApiPath', () => {
  test.each([
    ['/api/explore', true],
    ['/api', true],
    ['/apiary', false],
    ['/explore', false],
  ])('%s -> %s', (path, expected) => expect(isApiPath(path)).toBe(expected));
});
