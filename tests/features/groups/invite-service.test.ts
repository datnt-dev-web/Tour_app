import { describe, expect, test } from 'vitest';
import { AppError } from '@/shared/errors';
import { acceptInvite, createInvite } from '@/features/groups/services/invite-service';
import { fakeRepo, future, past } from './fake-invites-repo';

describe('createInvite', () => {
  test('token base64url 32 byte, url theo origin, hạn mặc định 7 ngày', async () => {
    const { repo, invites } = fakeRepo();
    const { url } = await createInvite(repo, { groupId: 'g1', createdBy: 'u1', origin: 'https://app.test' });
    const token = url.replace('https://app.test/invite/', '');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const days = (Date.parse(invites[token].expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });
});

describe('acceptInvite', () => {
  test('token hợp lệ → thêm vào group_members', async () => {
    const { repo, members } = fakeRepo({ invites: { t: { id: 'i1', group_id: 'g1', expires_at: future(), used_by: null } } });
    expect(await acceptInvite(repo, 't', 'u2')).toEqual({ groupId: 'g1' });
    expect(members.has('g1:u2')).toBe(true);
  });
  test('token hết hạn → INVITE_INVALID', async () => {
    const { repo } = fakeRepo({ invites: { t: { id: 'i1', group_id: 'g1', expires_at: past(), used_by: null } } });
    await expect(acceptInvite(repo, 't', 'u2')).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  });
  test('token đã dùng → INVITE_INVALID', async () => {
    const { repo } = fakeRepo({ invites: { t: { id: 'i1', group_id: 'g1', expires_at: future(), used_by: 'u9' } } });
    await expect(acceptInvite(repo, 't', 'u2')).rejects.toBeInstanceOf(AppError);
  });
  test('token không tồn tại → INVITE_INVALID', async () => {
    const { repo } = fakeRepo();
    await expect(acceptInvite(repo, 'nope', 'u2')).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  });
  test('đã là thành viên → trả groupId, không đốt token', async () => {
    const { repo, invites } = fakeRepo({ invites: { t: { id: 'i1', group_id: 'g1', expires_at: future(), used_by: null } }, members: [['g1', 'u2']] });
    expect(await acceptInvite(repo, 't', 'u2')).toEqual({ groupId: 'g1' });
    expect(invites.t.used_by).toBeNull();
  });
});
