import { describe, expect, test } from 'vitest';
import { isApiPath, isPublicPath } from '@/shared/supabase/public-paths';

describe('isPublicPath', () => {
  test.each([
    ['/login', true],
    ['/sw.js', true],
    ['/manifest.webmanifest', true],
    ['/offline', true],
    ['/', false],
    ['/explore', false],
    ['/loginx', false],
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
