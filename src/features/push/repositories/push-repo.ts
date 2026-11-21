import type { PushTarget } from '@/integrations/web-push/client';
import type { Db } from '@/shared/supabase/db';

export interface DueReminder {
  tripPlaceId: string;
  tripId: string;
  groupId: string;
  placeName: string;
  tripName: string;
  visitAt: string;
}

export type GroupTarget = PushTarget & { groupId: string };

export interface PushRepo {
  saveSubscription(userId: string, target: PushTarget): Promise<void>;
  removeSubscription(userId: string, endpoint: string): Promise<void>;
  dueReminders(windowMin: number): Promise<DueReminder[]>;
  /** Đánh dấu đã nhắc; trả các chỗ chèn được (chưa ai nhắc). Chèn trước khi gửi để hai lượt cron chồng nhau không gửi trùng. */
  claim(reminders: Pick<DueReminder, 'tripPlaceId' | 'visitAt'>[]): Promise<Set<string>>;
  targetsForGroups(groupIds: string[]): Promise<GroupTarget[]>;
  removeEndpoints(endpoints: string[]): Promise<void>;
}

/** db là client service role: hai bảng push không có policy cho người dùng, server đã kiểm phiên trước khi gọi. */
export function createPushRepo(db: Db): PushRepo {
  const must = <T>(r: { data: T; error: unknown }): T => {
    if (r.error) throw r.error;
    return r.data;
  };
  /** Truy vấn không lỗi thì data luôn có (select list / insert có returning). */
  const mustData = <T>(r: { data: T; error: unknown }): NonNullable<T> => must(r) as NonNullable<T>;

  return {
    async saveSubscription(userId, { endpoint, p256dh, auth }) {
      // Máy dùng chung đổi người: endpoint giữ nguyên, chuyển sang người đang đăng nhập.
      must(await db.from('push_subscriptions').upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' }));
    },

    async removeSubscription(userId, endpoint) {
      must(await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint));
    },

    async dueReminders(windowMin) {
      const rows = must(await db.rpc('due_push_reminders', { p_window_min: windowMin })) ?? [];
      return rows.map((r) => ({
        tripPlaceId: r.trip_place_id,
        tripId: r.trip_id,
        groupId: r.group_id,
        placeName: r.place_name,
        tripName: r.trip_name,
        visitAt: r.visit_at,
      }));
    },

    async claim(reminders) {
      if (reminders.length === 0) return new Set();
      const rows = mustData(
        await db
          .from('push_reminders_sent')
          .upsert(
            reminders.map((r) => ({ trip_place_id: r.tripPlaceId, visit_at: r.visitAt })),
            { onConflict: 'trip_place_id,visit_at', ignoreDuplicates: true },
          )
          .select('trip_place_id'),
      );
      return new Set(rows.map((r) => r.trip_place_id));
    },

    async targetsForGroups(groupIds) {
      if (groupIds.length === 0) return [];
      const members = mustData(await db.from('group_members').select('group_id, user_id').in('group_id', groupIds));
      if (members.length === 0) return [];
      const subs = mustData(
        await db
          .from('push_subscriptions')
          .select('user_id, endpoint, p256dh, auth')
          .in('user_id', [...new Set(members.map((m) => m.user_id))]),
      );
      return members.flatMap((m) =>
        subs.filter((s) => s.user_id === m.user_id).map((s) => ({ groupId: m.group_id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      );
    },

    async removeEndpoints(endpoints) {
      if (endpoints.length === 0) return;
      must(await db.from('push_subscriptions').delete().in('endpoint', endpoints));
    },
  };
}
