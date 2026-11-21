'use client';

import { formatDayMonth } from '@/shared/date';
import { parseMoney } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { DURATION_PRESETS_MIN, TRANSPORT_PRESETS } from '../constants';
import { addMinutes } from '../services/timeline';

export const FIELD = 'min-h-11 w-full rounded border border-line bg-card px-3 text-sm';

/** Giá trị đang sửa của khung giờ; `endTime` rỗng là không có giờ kết thúc. */
export interface ScheduleDraft {
  date: string;
  time: string;
  endTime: string;
}

const durationLabel = (m: number) => (m < 60 ? `${m}p` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`);

/** Kết thúc trước hoặc bằng lúc bắt đầu thì không hợp lệ. */
export const endTimeInvalid = (d: ScheduleDraft) => d.endTime !== '' && d.endTime <= d.time;

/**
 * Ngày (theo các ngày của chuyến), giờ bắt đầu, giờ kết thúc. Chuyến một ngày thì ẩn phần chọn ngày;
 * chuyến chưa có ngày thì nhập ngày tự do. Nút thời lượng đặt giờ kết thúc theo giờ bắt đầu.
 */
export function ScheduleFields({ days, value, onChange }: { days: string[]; value: ScheduleDraft; onChange: (v: ScheduleDraft) => void }) {
  const badEnd = endTimeInvalid(value);
  return (
    <div className="flex flex-col gap-2">
      {days.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ngày">
          {days.map((d, i) => (
            <Chip key={d} selected={value.date === d} onClick={() => onChange({ ...value, date: d })} className="px-3">
              Ngày {i + 1} · {formatDayMonth(d)}
            </Chip>
          ))}
        </div>
      )}
      {days.length === 0 && (
        <input type="date" required aria-label="Ngày" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={FIELD} />
      )}
      <div className="flex items-center gap-2">
        <input
          type="time"
          required
          aria-label="Giờ bắt đầu"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className={FIELD}
        />
        <span aria-hidden className="text-muted">
          –
        </span>
        <input
          type="time"
          aria-label="Giờ kết thúc"
          value={value.endTime}
          onChange={(e) => onChange({ ...value, endTime: e.target.value })}
          aria-invalid={badEnd || undefined}
          className={`${FIELD} ${badEnd ? 'border-bad! text-bad' : ''}`}
        />
      </div>
      {value.time && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Thời lượng">
          {DURATION_PRESETS_MIN.map((m) => {
            const end = addMinutes(value.time, m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={value.endTime === end}
                onClick={() => onChange({ ...value, endTime: end })}
                className={`min-h-9 rounded-sm border px-2.5 text-xs font-semibold pressable ${
                  value.endTime === end ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-surface'
                }`}
              >
                +{durationLabel(m)}
              </button>
            );
          })}
          {value.endTime && (
            <button type="button" onClick={() => onChange({ ...value, endTime: '' })} className="min-h-9 rounded-sm px-2.5 text-xs font-semibold text-muted pressable hover:bg-surface">
              Không giờ kết thúc
            </button>
          )}
        </div>
      )}
      {badEnd && <p className="text-xs text-bad">Giờ kết thúc phải sau giờ bắt đầu.</p>}
    </div>
  );
}

/** Cột "Di chuyển": chọn nhanh hoặc gõ tự do; bấm lại lựa chọn đang chọn để bỏ. */
export function TransportField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Di chuyển">
        {TRANSPORT_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={value === t}
            onClick={() => onChange(value === t ? '' : t)}
            className={`min-h-9 rounded-sm border px-2.5 text-xs font-semibold pressable ${
              value === t ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-surface'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input aria-label="Di chuyển khác" maxLength={40} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Hoặc gõ: xe đạp, thuyền..." className={FIELD} />
    </div>
  );
}

export interface StopDraft extends ScheduleDraft {
  transport: string;
  /** Chuỗi người dùng gõ; parse lúc lưu (gõ tắt 120k, 1tr2). */
  cost: string;
}

/** Ô sửa một chỗ ngay tại dòng (Danh sách hoặc Timeline): khung giờ, di chuyển, giá cả nhóm. */
export function StopEditor({
  days,
  value,
  onChange,
  onSave,
  onClearSchedule,
  onCancel,
}: {
  days: string[];
  value: StopDraft;
  onChange: (v: StopDraft) => void;
  onSave: () => void;
  /** Có khi chỗ đang có giờ: bỏ giờ để về mục "Chưa xếp giờ". */
  onClearSchedule?: () => void;
  onCancel: () => void;
}) {
  const cost = parseMoney(value.cost);
  const invalid = !value.date || !value.time || endTimeInvalid(value) || cost === undefined;
  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-line bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onSave();
      }}
    >
      <ScheduleFields days={days} value={value} onChange={(s) => onChange({ ...value, ...s })} />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Di chuyển</span>
        <TransportField value={value.transport} onChange={(transport) => onChange({ ...value, transport })} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tổng tiền cả nhóm</span>
        <input
          inputMode="numeric"
          value={value.cost}
          onChange={(e) => onChange({ ...value, cost: e.target.value })}
          placeholder="Chưa có giá (gõ tắt 120k, 1tr2)"
          aria-invalid={cost === undefined || undefined}
          className={`${FIELD} tabular-nums ${cost === undefined ? 'border-bad! text-bad' : ''}`}
        />
      </label>
      <div className="flex gap-2">
        {onClearSchedule && (
          <Button variant="ghost" className="text-bad" onClick={onClearSchedule}>
            Bỏ giờ
          </Button>
        )}
        <Button variant="secondary" className="ml-auto" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={invalid}>
          Lưu
        </Button>
      </div>
    </form>
  );
}
