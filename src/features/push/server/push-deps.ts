import 'server-only';
import { createWebPushSender } from '@/integrations/web-push/client';
import { getEnv, webPushConfig } from '@/shared/config/env';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { createPushRepo } from '../repositories/push-repo';
import type { ReminderDeps } from '../services/reminder-service';

/** Repo dùng client service role (bảng push không mở cho người dùng); người gọi phải tự kiểm phiên trước. */
export const createAdminPushRepo = () => createPushRepo(createAdminSupabase());

/** null khi chưa cấu hình khóa VAPID: tính năng thông báo đẩy tắt. */
export function createReminderDeps(): ReminderDeps | null {
  const cfg = webPushConfig(getEnv());
  return cfg ? { repo: createAdminPushRepo(), push: createWebPushSender(cfg) } : null;
}
