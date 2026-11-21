import { describe, expect, test, vi } from 'vitest';
import type { DueReminder, GroupTarget, PushRepo } from '@/features/push/repositories/push-repo';
import { sendDueReminders } from '@/features/push/services/reminder-service';
import type { PushOutcome, PushSender } from '@/integrations/web-push/client';

const NOW = new Date('2026-11-23T01:20:00Z'); // 08:20 giờ Việt Nam
const due = (id: string, groupId: string, visitAt: string): DueReminder => ({
  tripPlaceId: id,
  tripId: `trip-${groupId}`,
  groupId,
  placeName: `Quán ${id}`,
  tripName: 'Hải Phòng',
  visitAt,
});
const target = (endpoint: string, groupId: string): GroupTarget => ({ endpoint, groupId, p256dh: 'k', auth: 'a' });

function fakeRepo(reminders: DueReminder[], targets: GroupTarget[], alreadyClaimed: string[] = []) {
  const repo: PushRepo = {
    saveSubscription: vi.fn(),
    removeSubscription: vi.fn(),
    dueReminders: vi.fn(async () => reminders),
    claim: vi.fn(async (rs: Pick<DueReminder, 'tripPlaceId' | 'visitAt'>[]) => new Set(rs.map((r) => r.tripPlaceId).filter((id) => !alreadyClaimed.includes(id)))),
    targetsForGroups: vi.fn(async (groupIds: string[]) => targets.filter((t) => groupIds.includes(t.groupId))),
    removeEndpoints: vi.fn(async () => {}),
  };
  return repo;
}
const sender = (outcome: (endpoint: string) => PushOutcome = () => 'sent') => {
  const send = vi.fn<PushSender['send']>(async (t) => outcome(t.endpoint));
  return { push: { send } satisfies PushSender, send };
};

describe('sendDueReminders', () => {
  test('gửi mỗi chỗ tới mọi máy của thành viên đúng nhóm, kèm số phút còn lại và link mở tab Hôm nay', async () => {
    const repo = fakeRepo([due('a', 'g1', '2026-11-23T01:45:00Z')], [target('e1', 'g1'), target('e2', 'g1'), target('e3', 'g2')]);
    const { push, send } = sender();
    const r = await sendDueReminders({ repo, push }, NOW);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map((c) => c[0].endpoint).sort()).toEqual(['e1', 'e2']);
    expect(send.mock.calls[0][1]).toEqual({ title: 'Quán a', body: 'Còn 25 phút nữa tới giờ · Hải Phòng', tag: 'a', url: '/trips/trip-g1?view=today' });
    expect(r).toEqual({ due: 1, sent: 2, removed: 0 });
  });

  test('chỗ đã có lượt khác nhận (claim thất bại) thì không gửi lại', async () => {
    const repo = fakeRepo([due('a', 'g1', '2026-11-23T01:45:00Z'), due('b', 'g1', '2026-11-23T01:30:00Z')], [target('e1', 'g1')], ['a']);
    const { push, send } = sender();
    await sendDueReminders({ repo, push }, NOW);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toMatchObject({ tag: 'b' });
  });

  test('đăng ký đã hết hạn (gone) bị xóa, lỗi tạm thời thì giữ', async () => {
    const repo = fakeRepo([due('a', 'g1', '2026-11-23T01:45:00Z')], [target('dead', 'g1'), target('flaky', 'g1'), target('ok', 'g1')]);
    const { push } = sender((e) => (e === 'dead' ? 'gone' : e === 'flaky' ? 'failed' : 'sent'));
    const r = await sendDueReminders({ repo, push }, NOW);
    expect(repo.removeEndpoints).toHaveBeenCalledWith(['dead']);
    expect(r).toEqual({ due: 1, sent: 1, removed: 1 });
  });

  test('không có chỗ nào sắp tới giờ thì không hỏi danh sách máy', async () => {
    const repo = fakeRepo([], [target('e1', 'g1')]);
    const { push, send } = sender();
    expect(await sendDueReminders({ repo, push }, NOW)).toEqual({ due: 0, sent: 0, removed: 0 });
    expect(repo.targetsForGroups).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test('còn dưới 1 phút vẫn ghi "Còn 1 phút"', async () => {
    const repo = fakeRepo([due('a', 'g1', '2026-11-23T01:20:20Z')], [target('e1', 'g1')]);
    const { push, send } = sender();
    await sendDueReminders({ repo, push }, NOW);
    expect(send.mock.calls[0][1]).toMatchObject({ body: 'Còn 1 phút nữa tới giờ · Hải Phòng' });
  });
});
