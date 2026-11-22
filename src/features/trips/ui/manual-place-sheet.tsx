'use client';

import { useState, type FormEvent } from 'react';
import { SuggestInput } from '@/features/geo/ui/suggest-input';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { todayInVietnam } from '@/shared/date';
import { parseMoney } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { Sheet } from '@/shared/ui/sheet';
import { FIELD } from '@/shared/ui/field';
import type { TripPlace } from '../repositories/trips-repo';
import { defaultDay, lastTransport, suggestTime } from '../services/timeline';
import { endTimeInvalid, ScheduleFields, TransportField, type ScheduleDraft } from './stop-editor';
import { useAddManualPlace } from './use-trip-mutations';

/**
 * Bottom sheet thêm quán/địa điểm nhóm đã biết, kèm giờ cho timeline. "Thêm & nhập tiếp" giữ ngày, loại
 * và đẩy giờ gợi ý lên một khoảng, để nhập liền cả lịch trình trong một lần mở.
 */
export function ManualPlaceSheet({
  tripId,
  city,
  days,
  items,
  onClose,
}: {
  tripId: string;
  /** Thành phố của chuyến, để gợi ý địa chỉ ở đó trước. */
  city: string;
  days: string[];
  items: Pick<TripPlace, 'visit_date' | 'visit_time' | 'visit_end_time' | 'transport'>[];
  onClose: () => void;
}) {
  const add = useAddManualPlace(tripId);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const parsedCost = parseMoney(cost);
  const [category, setCategory] = useState<StoredPlaceCategory>('food');
  const [withTime, setWithTime] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => {
    const date = defaultDay(days, todayInVietnam()) ?? todayInVietnam();
    return { date, time: suggestTime(items, date), endTime: '' };
  });
  // Nhóm thường đi một kiểu suốt chuyến (ví dụ xe máy thuê): lấy sẵn theo chỗ gần nhất.
  const [transport, setTransport] = useState(() => lastTransport(items) ?? '');
  const invalid = parsedCost === undefined || (withTime && endTimeInvalid(schedule));
  const [added, setAdded] = useState<string[]>([]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Nút nào gửi form: đọc từ submitter (state đặt trong onClick chưa kịp cập nhật khi submit chạy).
    const keepOpen = (e.nativeEvent as SubmitEvent).submitter?.dataset.keepOpen === 'true';
    if (invalid) return;
    const payload = {
      name,
      address,
      note,
      category,
      schedule: withTime ? { ...schedule, endTime: schedule.endTime || null } : null,
      transport: transport.trim() || null,
      cost: parsedCost,
    };
    add.mutate(payload, {
      onSuccess: () => {
        if (!keepOpen) return onClose();
        setAdded((a) => [...a, name.trim()]);
        setName('');
        setAddress('');
        setNote('');
        setCost('');
        // Chỗ tiếp theo: sau giờ kết thúc một quãng đi đường (hoặc sau giờ bắt đầu một tiếng).
        if (withTime) {
          setSchedule((s) => ({
            ...s,
            time: suggestTime([{ visit_date: s.date, visit_time: s.time, visit_end_time: s.endTime || null }], s.date),
            endTime: '',
          }));
        }
      },
    });
  }

  return (
    <Sheet title="Thêm chỗ" description="Đã biết quán thì nhập luôn, không cần tìm." onClose={onClose}>
      {added.length > 0 && (
        <p role="status" className="rounded bg-good-bg p-2 text-sm text-good">
          Đã thêm: {added.join(', ')}
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tên quán / địa điểm
          <input required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ Bánh đa cua bà Cụ" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Địa chỉ <span className="font-normal text-muted">(không bắt buộc, có thì hiện trên bản đồ)</span>
          <SuggestInput
            kind="address"
            city={city}
            maxLength={200}
            value={address}
            onChange={setAddress}
            placeholder="Gõ tên phố, ví dụ Cầu Đất"
            className={`${FIELD} font-normal`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Loại</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Loại">
            {STORED_CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="px-3">
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} className="size-5 accent-accent" />
            Xếp giờ cho timeline
          </label>
          {withTime && <ScheduleFields days={days} value={schedule} onChange={setSchedule} />}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Di chuyển</span>
          <TransportField value={transport} onChange={setTransport} />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tổng tiền cả nhóm <span className="font-normal text-muted">(không bắt buộc, gõ tắt được 120k, 1tr2)</span>
          <input
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Chưa có giá"
            aria-invalid={parsedCost === undefined || undefined}
            className={`${FIELD} font-normal tabular-nums ${parsedCost === undefined ? 'border-bad! text-bad' : ''}`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Ghi chú
          <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Món nên gọi, giá, đặt bàn..." className="w-full rounded border border-line bg-card p-3 text-sm" />
        </label>

        {add.error && (
          <p role="alert" className="text-sm text-bad">
            {add.error.message}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1" disabled={add.isPending || !name.trim() || invalid} data-keep-open="true">
            Thêm & nhập tiếp
          </Button>
          <Button type="submit" className="flex-1" disabled={add.isPending || !name.trim() || invalid}>
            {add.isPending ? 'Đang thêm...' : 'Thêm'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
