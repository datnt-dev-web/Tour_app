'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createAdminPushRepo } from '../server/push-deps';

// Chỉ nhận endpoint của dịch vụ đẩy chính thức (Chrome/Edge, Firefox, Safari, Windows): server sẽ POST tới địa chỉ này,
// không giới hạn thì thành viên nhóm có thể khiến server gửi request tới máy chủ tùy ý.
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/i;
const endpoint = z
  .string()
  .url()
  .startsWith('https://')
  .max(1000)
  .refine((u) => PUSH_HOSTS.test(new URL(u).hostname));
const subscribeSchema = z.object({ endpoint, keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });
const unsubscribeSchema = z.object({ endpoint });

/** Lưu đăng ký của máy này cho người đang đăng nhập (đè nếu máy đã đăng ký dưới người khác). */
export async function subscribePushAction(input: z.input<typeof subscribeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { userId } = await authed();
    const { endpoint, keys } = parse(subscribeSchema, input);
    await createAdminPushRepo().saveSubscription(userId, { endpoint, ...keys });
    return null;
  });
}

/** Chỉ xóa được đăng ký của chính mình. */
export async function unsubscribePushAction(input: z.input<typeof unsubscribeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { userId } = await authed();
    await createAdminPushRepo().removeSubscription(userId, parse(unsubscribeSchema, input).endpoint);
    return null;
  });
}
