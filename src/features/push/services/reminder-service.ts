import { REMINDER_MIN } from '@/features/trips/services/calendar';
import type { PushSender } from '@/integrations/web-push/client';
import type { PushRepo } from '../repositories/push-repo';

export interface ReminderDeps {
  repo: PushRepo;
  push: PushSender;
}

const MINUTE_MS = 60_000;

/**
 * Một lượt cron: gửi nhắc cho các chỗ sẽ tới giờ trong REMINDER_MIN phút (cùng mốc với lịch .ics) tới mọi máy
 * đã bật thông báo của thành viên nhóm. Chỗ được đánh dấu "đã nhắc" trước khi gửi, nên gửi lỗi tạm thời thì bỏ lượt đó
 * (đổi lại không bao giờ nhắc trùng). Đăng ký trình duyệt đã hủy thì xóa.
 */
export async function sendDueReminders(deps: ReminderDeps, now: Date = new Date()): Promise<{ due: number; sent: number; removed: number }> {
  const due = await deps.repo.dueReminders(REMINDER_MIN);
  const claimed = await deps.repo.claim(due);
  const mine = due.filter((d) => claimed.has(d.tripPlaceId));
  if (mine.length === 0) return { due: due.length, sent: 0, removed: 0 };

  const targets = await deps.repo.targetsForGroups([...new Set(mine.map((d) => d.groupId))]);
  const jobs = mine.flatMap((d) => {
    const minutes = Math.max(1, Math.round((Date.parse(d.visitAt) - now.getTime()) / MINUTE_MS));
    // tag = id chỗ: trùng với nhắc trong app (useInAppReminder) nên hệ điều hành thay thế thay vì hiện hai lần.
    const payload = { title: d.placeName, body: `Còn ${minutes} phút nữa tới giờ · ${d.tripName}`, tag: d.tripPlaceId, url: `/trips/${d.tripId}?view=today` };
    return targets.filter((t) => t.groupId === d.groupId).map(async (t) => ({ endpoint: t.endpoint, outcome: await deps.push.send(t, payload) }));
  });
  const results = await Promise.all(jobs);

  const gone = [...new Set(results.filter((r) => r.outcome === 'gone').map((r) => r.endpoint))];
  await deps.repo.removeEndpoints(gone);
  return { due: due.length, sent: results.filter((r) => r.outcome === 'sent').length, removed: gone.length };
}
