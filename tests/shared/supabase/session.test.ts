import { beforeEach, describe, expect, test, vi } from 'vitest';

const auth = { getClaims: vi.fn(), getUser: vi.fn() };
vi.mock('@/shared/supabase/server', () => ({ createServerSupabase: async () => ({ auth }) }));

const { getSessionUser } = await import('@/shared/supabase/session');

describe('getSessionUser', () => {
  beforeEach(() => {
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
  });

  test('lấy id từ claims đã xác minh, không gọi Auth server qua getUser (đỡ một lượt mạng mỗi trang)', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null });
    expect(await getSessionUser()).toEqual({ id: 'u1' });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  test('chưa đăng nhập hoặc token hỏng thì null', async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error('bad jwt') });
    expect(await getSessionUser()).toBeNull();
  });
});
