import 'server-only';
import webpush, { WebPushError } from 'web-push';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** gone: trình duyệt đã hủy đăng ký (404/410), nên xóa khỏi DB; failed: lỗi tạm, để lượt sau. */
export type PushOutcome = 'sent' | 'gone' | 'failed';

export interface PushSender {
  send(target: PushTarget, payload: object): Promise<PushOutcome>;
}

// Thông báo nhắc giờ hết ý nghĩa sau khi đã tới giờ: dịch vụ đẩy giữ tối đa ngần này giây nếu máy đang tắt.
const TTL_SEC = 30 * 60;

/** Gửi Web Push ký bằng khóa VAPID; cấu hình truyền theo từng lần gọi, không đụng cấu hình toàn cục của thư viện. */
export function createWebPushSender(cfg: { publicKey: string; privateKey: string; subject: string }): PushSender {
  const vapidDetails = { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey };
  return {
    async send({ endpoint, p256dh, auth }, payload) {
      try {
        await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload), { vapidDetails, TTL: TTL_SEC, urgency: 'high' });
        return 'sent';
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) return 'gone';
        console.error('[web-push] gửi lỗi', e instanceof WebPushError ? e.statusCode : e);
        return 'failed';
      }
    },
  };
}
