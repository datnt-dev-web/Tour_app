import { describe, expect, test } from 'vitest';
import { canAccess } from '@/features/auth/services/access-service';
import { fakeRepo, future } from '../groups/fake-invites-repo';

const BOOT = ['owner@x.com'];

describe('canAccess', () => {
  test('email lạ không có invite → denied', async () => {
    const { repo } = fakeRepo();
    expect(await canAccess(repo, { id: 'u1', email: 'a@x.com' }, BOOT)).toBe('denied');
  });
  test('token không hợp lệ → denied', async () => {
    const { repo } = fakeRepo();
    expect(await canAccess(repo, { id: 'u1', email: 'a@x.com' }, BOOT, 'nope')).toBe('denied');
  });
  test('token hợp lệ → invite', async () => {
    const { repo } = fakeRepo({ invites: { t: { id: 'i1', group_id: 'g1', expires_at: future(), used_by: null } } });
    expect(await canAccess(repo, { id: 'u1', email: 'a@x.com' }, BOOT, 't')).toBe('invite');
  });
  test('bootstrap email lần đầu → tạo nhóm owner', async () => {
    const { repo, groups, members } = fakeRepo();
    expect(await canAccess(repo, { id: 'u1', email: 'Owner@X.com' }, BOOT)).toBe('bootstrap');
    expect(groups.map((g) => g.name)).toEqual(['Con lợn nhựa']);
    expect(members.has('g1:u1')).toBe(true);
  });
  test('thành viên sẵn có → member', async () => {
    const { repo, groups } = fakeRepo({ members: [['g1', 'u1']] });
    expect(await canAccess(repo, { id: 'u1', email: 'owner@x.com' }, BOOT)).toBe('member');
    expect(groups).toHaveLength(0);
  });
});
