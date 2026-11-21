'use client';

import { BellRing, CalendarPlus } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { PushToggle } from '@/features/push/ui/push-toggle';
import { REMINDER_MIN } from '../services/calendar';

const NOTIFIED_KEY = 'ft:notified';
const noopSubscribe = () => () => {};

/** Đã nhắc chỗ này chưa (lưu trên máy, để mở lại app không nhắc lặp). */
function markNotified(id: string): boolean {
  try {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'));
    if (seen.has(id)) return false;
    seen.add(id);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...seen].slice(-100)));
    return true;
  } catch {
    return true;
  }
}

/**
 * Nhắc khi app đang mở: còn ≤ REMINDER_MIN phút tới chỗ kế tiếp thì hiện thông báo của trình duyệt (một lần mỗi chỗ).
 * Nhắc cả khi đã đóng app thì dùng file lịch (.ics) ở nút bên cạnh.
 */
export function useInAppReminder(next: { id: string; name: string; minutesUntil: number | null } | null) {
  const id = next?.id;
  const name = next?.name;
  const minutesUntil = next?.minutesUntil ?? null;
  useEffect(() => {
    if (!id || !name || minutesUntil === null || minutesUntil < 0 || minutesUntil > REMINDER_MIN) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!markNotified(id)) return;
    void navigator.serviceWorker?.getRegistration().then((reg) => {
      const body = `Còn ${minutesUntil} phút nữa tới giờ.`;
      if (reg) void reg.showNotification(name, { body, tag: id, icon: '/icons/icon-192.png' });
      else new Notification(name, { body, tag: id });
    });
  }, [id, name, minutesUntil]);
}

/** Thêm lịch trình vào lịch điện thoại (.ics, nhắc trước 30 phút) và bật thông báo đẩy (nhắc cả khi đóng app). */
export function ReminderActions({ tripId, light = false }: { tripId: string; light?: boolean }) {
  // Quyền thông báo không có sự kiện đổi: đọc lại sau khi hỏi (bump), server luôn coi là chưa hỗ trợ.
  const [, bump] = useState(0);
  const permission = useSyncExternalStore(
    noopSubscribe,
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
    () => 'unsupported' as const,
  );
  const btn = `inline-flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-semibold pressable ${light ? 'bg-white/10 text-white hover:bg-white/15' : 'border border-line bg-card text-ink hover:bg-surface'}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/trips/${tripId}/calendar`} download className={btn}>
        <CalendarPlus size={16} aria-hidden />
        Thêm vào lịch điện thoại
      </a>
      <PushToggle
        btnClass={btn}
        hintClass={`w-full text-sm ${light ? 'text-white/70' : 'text-muted'}`}
        // Máy không dùng được push: vẫn nhắc được khi đang mở app.
        fallback={
          permission === 'default' && (
            <button type="button" onClick={() => void Notification.requestPermission().then(() => bump((n) => n + 1))} className={btn}>
              <BellRing size={16} aria-hidden />
              Bật nhắc trong app
            </button>
          )
        }
      />
    </div>
  );
}
