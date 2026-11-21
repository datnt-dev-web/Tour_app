import { describe, expect, test } from 'vitest';
import { findLoginUser } from '@/features/auth/services/username-login-service';

function deps(users: Record<string, string>, members: string[]) {
  return {
    accounts: { findUserIdByUsername: async (u: string) => users[u] ?? null },
    groups: { hasAnyGroup: async (id: string) => members.includes(id) },
  };
}

describe('findLoginUser', () => {
  test('username có thật và có nhóm → userId, không phân biệt hoa thường/khoảng trắng', async () => {
    expect(await findLoginUser(deps({ 'an.vu': 'u1' }, ['u1']), '  An.Vu ')).toBe('u1');
  });
  test.each([
    ['không tồn tại', deps({}, []), 'binh'],
    ['chưa có nhóm', deps({ 'an.vu': 'u1' }, []), 'an.vu'],
    ['sai định dạng', deps({ 'a b': 'u1' }, ['u1']), 'a b'],
    ['rỗng', deps({}, []), '   '],
  ])('%s → INVALID_LOGIN', async (_name, d, input) => {
    await expect(findLoginUser(d, input)).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
  });
});
