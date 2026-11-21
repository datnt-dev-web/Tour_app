import { timingSafeEqual } from 'node:crypto';
import { errorResponse } from '@/features/ai/server/ai-request';
import { createReminderDeps } from '@/features/push/server/push-deps';
import { sendDueReminders } from '@/features/push/services/reminder-service';
import { getEnv } from '@/shared/config/env';

/** So khóa không rò thời gian (không để đoán dần từng ký tự qua độ trễ phản hồi). */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** pg_cron (Supabase) gọi mỗi 5 phút với Authorization: Bearer CRON_SECRET; gửi thông báo nhắc giờ. */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  const deps = createReminderDeps();
  if (!secret || !deps) return errorResponse('PUSH_DISABLED', 'Chưa cấu hình thông báo đẩy.', 503);

  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!sameSecret(given, secret)) return errorResponse('UNAUTHENTICATED', 'Sai khóa.', 401);

  return Response.json(await sendDueReminders(deps), { headers: { 'Cache-Control': 'no-store' } });
}
