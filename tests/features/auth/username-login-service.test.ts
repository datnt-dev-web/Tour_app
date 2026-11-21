import { describe, expect, test, vi } from 'vitest';
import { changePin, findLoginUser, generatePin, signInWithPin } from '@/features/auth/services/username-login-service';

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

describe('signInWithPin', () => {
  const base = () => ({
    ...deps({ 'an.vu': 'u1' }, ['u1']),
    findEmail: vi.fn(async () => 'an.vu@food-tour.local'),
    signIn: vi.fn(async (_email: string, pin: string) => pin === '123456'),
  });

  test('username + PIN đúng → đăng nhập bằng email của user đó', async () => {
    const d = base();
    await signInWithPin(d, ' An.Vu ', ' 123456 ');
    expect(d.signIn).toHaveBeenCalledWith('an.vu@food-tour.local', '123456');
  });

  test.each([
    ['PIN sai', 'an.vu', '654321'],
    ['PIN không đủ 6 số', 'an.vu', '1234'],
    ['PIN có chữ', 'an.vu', '12345a'],
    ['username không có', 'binh', '123456'],
  ])('%s → cùng một lỗi INVALID_LOGIN', async (_name, u, pin) => {
    await expect(signInWithPin(base(), u, pin)).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
  });

  test('PIN sai định dạng thì không gọi Auth (đỡ tốn lượt giới hạn đăng nhập)', async () => {
    const d = base();
    await expect(signInWithPin(d, 'an.vu', '12')).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
    expect(d.signIn).not.toHaveBeenCalled();
  });
});

describe('PIN', () => {
  test('generatePin: đúng 6 chữ số, không lặp lại cố định', () => {
    const pins = new Set(Array.from({ length: 20 }, () => generatePin()));
    for (const p of pins) expect(p).toMatch(/^\d{6}$/);
    expect(pins.size).toBeGreaterThan(1);
  });

  test('changePin: PIN hiện tại sai thì không đổi; PIN mới phải 6 số và khác PIN cũ', async () => {
    const auth = { verify: vi.fn(async (pin: string) => pin === '111111'), update: vi.fn(async () => {}) };
    await expect(changePin(auth, { current: '000000', next: '222222' })).rejects.toMatchObject({ code: 'WRONG_PIN' });
    await expect(changePin(auth, { current: '111111', next: '22' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    await expect(changePin(auth, { current: '111111', next: '111111' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    expect(auth.update).not.toHaveBeenCalled();
    await changePin(auth, { current: '111111', next: '222222' });
    expect(auth.update).toHaveBeenCalledWith('222222');
  });
});
