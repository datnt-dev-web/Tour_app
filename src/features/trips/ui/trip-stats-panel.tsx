'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2, Users, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { CATEGORY_LABELS } from '@/features/places/constants';
import { formatDayMonth } from '@/shared/date';
import { formatVnd, parseMoney, perPerson } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Pagination } from '@/shared/ui/pagination';
import { Skeleton } from '@/shared/ui/skeleton';
import type { RawTripStats, TripInfo } from '../repositories/trips-repo';
import { tripDays } from '../services/timeline';
import { toTripStats } from '../services/trip-stats';
import { SettlePanel } from './settle-panel';
import { MoneyInput } from './money-input';
import { FIELD } from './stop-editor';
import { tripStatsQuery } from './trip-queries';
import { stopsFilter } from './trip-view';
import { usePagedStops, type InitialStops } from './use-paged-stops';
import { useAddExpense, useRemoveExpense, useSetPartySize, useUpdateStop } from './use-trip-mutations';

const MAX_PARTY = 100;
const vnd = (n: number) => `${formatVnd(n)}đ`;

/** Thanh tỉ lệ dùng chung cho các mục phân bổ. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-line">
      <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { key: string; label: string; total: number }[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{r.label}</span>
              <span className="font-semibold tabular-nums">{vnd(r.total)}</span>
            </div>
            <Bar value={r.total} max={max} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExpenseForm({ onAdd }: { onAdd: (v: { label: string; amount: number }) => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const parsed = parseMoney(amount);
  const valid = label.trim() !== '' && typeof parsed === 'number';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({ label, amount: parsed });
    setLabel('');
    setAmount('');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Khoản chi"
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vé tàu, khách sạn, thuê xe..."
          className={`${FIELD} flex-[3]`}
        />
        <input
          aria-label="Số tiền"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1tr2"
          aria-invalid={parsed === undefined || undefined}
          className={`${FIELD} flex-[2] tabular-nums ${parsed === undefined ? 'border-bad! text-bad' : ''}`}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={!valid}>
        <Plus size={16} aria-hidden />
        Thêm khoản chi
      </Button>
    </form>
  );
}

/**
 * Thống kê chi phí theo cách nhóm vẫn lập bảng: mỗi chỗ ghi tổng tiền cả nhóm, chi phí khác (vé, phòng)
 * ghi riêng, mọi con số chia theo số người. Chỗ chưa có giá được đếm riêng để biết tổng còn thiếu.
 */
export function TripStatsPanel({
  tripId,
  info,
  initialStats,
  initialStops,
}: {
  tripId: string;
  info: TripInfo;
  initialStats?: RawTripStats;
  initialStops?: InitialStops;
}) {
  const priceTop = useRef<HTMLDivElement>(null);
  const { data: raw, isError } = useQuery({ ...tripStatsQuery(tripId), initialData: initialStats });
  const prices = usePagedStops(tripId, stopsFilter('stats', 'all'), initialStops);
  const updateStop = useUpdateStop(tripId);
  const setPartySize = useSetPartySize(tripId);
  const addExpense = useAddExpense(tripId);
  const removeExpense = useRemoveExpense(tripId);
  const error = updateStop.error ?? setPartySize.error ?? addExpense.error ?? removeExpense.error;

  const days = tripDays(info.trip);
  // Số người lấy từ thông tin chuyến (sửa lạc quan) để chia đầu người đổi ngay khi bấm − / +.
  const people = info.trip.party_size;
  const stats = raw ? toTripStats({ ...raw, people }, days) : null;
  const spentPct = stats && stats.total > 0 ? Math.round((stats.spent / stats.total) * 100) : 0;

  function goTo(page: number) {
    prices.setPage(page);
    priceTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error.message}
        </p>
      )}

      {!stats ? (
        isError ? (
          <p className="py-8 text-center text-sm text-bad">Không tải được thống kê, thử lại sau.</p>
        ) : (
          <Skeleton className="h-56" />
        )
      ) : (
        <>
      <section className="rounded bg-deep p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Tổng dự kiến</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{vnd(stats.total)}</p>
            <p className="text-sm text-white/80 tabular-nums">{vnd(stats.perPerson)} / người</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-sm bg-white/8 p-1" role="group" aria-label="Số người">
            <button
              type="button"
              aria-label="Bớt một người"
              disabled={people <= 1}
              onClick={() => setPartySize.mutate(people - 1)}
              className="inline-flex size-9 items-center justify-center rounded-sm pressable hover:bg-white/10 disabled:opacity-40"
            >
              <Minus size={16} aria-hidden />
            </button>
            <span className="flex min-w-12 items-center justify-center gap-1 text-sm font-bold tabular-nums">
              <Users size={14} aria-hidden />
              {people}
            </span>
            <button
              type="button"
              aria-label="Thêm một người"
              disabled={people >= MAX_PARTY}
              onClick={() => setPartySize.mutate(people + 1)}
              className="inline-flex size-9 items-center justify-center rounded-sm pressable hover:bg-white/10 disabled:opacity-40"
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-sm bg-white/8 p-3">
            <dt className="text-xs text-white/70">Ăn uống, vui chơi</dt>
            <dd className="font-bold tabular-nums">{vnd(stats.placesTotal)}</dd>
          </div>
          <div className="rounded-sm bg-white/8 p-3">
            <dt className="text-xs text-white/70">Chi phí khác</dt>
            <dd className="font-bold tabular-nums">{vnd(stats.expensesTotal)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-1">
          <div className="flex justify-between text-xs text-white/70">
            <span>Đã chi {vnd(stats.spent)}</span>
            <span>
              Đã đi {stats.progress.visited}/{stats.progress.total} chỗ
            </span>
          </div>
          <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full rounded-full bg-highlight" style={{ width: `${spentPct}%` }} />
          </span>
        </div>

        {stats.unpriced > 0 && (
          <p className="mt-3 text-xs text-white/70">Chưa gồm {stats.unpriced} chỗ chưa có giá. Nhập giá bên dưới để tổng đủ hơn.</p>
        )}
      </section>

      <Breakdown
        title="Theo ngày"
        rows={stats.byDay.map((d) => ({
          key: d.date ?? 'none',
          label: d.date ? `${d.dayNumber ? `Ngày ${d.dayNumber} · ` : ''}${formatDayMonth(d.date)}` : 'Chưa xếp giờ',
          total: d.total,
        }))}
      />
      <Breakdown title="Theo loại" rows={stats.byCategory.map((c) => ({ key: c.category, label: `${CATEGORY_LABELS[c.category]} (${c.count})`, total: c.total }))} />
        </>
      )}

      <div ref={priceTop} className="scroll-mt-4">
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Giá từng chỗ (cả nhóm)</h2>
          {stats && (
            <span className="text-xs text-muted">
              {stats.priced}/{stats.progress.total} có giá
            </span>
          )}
        </div>
        {prices.isPending ? (
          <Skeleton className="h-40" />
        ) : prices.items.length === 0 ? (
          <p className="text-sm text-muted">Chuyến chưa có chỗ nào.</p>
        ) : (
          <ul className={`flex flex-col divide-y divide-line transition-opacity duration-(--dur-base) ${prices.isSwitching ? 'opacity-60' : ''}`}>
            {prices.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${item.status === 'visited' ? 'text-muted' : ''}`}>{item.place.name}</p>
                  {item.cost !== null && <p className="text-xs text-muted tabular-nums">{vnd(perPerson(item.cost, people))}/người</p>}
                </div>
                <MoneyInput
                  aria-label={`Giá ${item.place.name}`}
                  placeholder="Chưa có giá"
                  value={item.cost}
                  onCommit={(cost) => updateStop.mutate({ tripPlaceId: item.id, patch: { cost } })}
                  className="min-h-11 w-32 shrink-0 rounded border border-line bg-card px-3 text-right text-sm"
                />
              </li>
            ))}
          </ul>
        )}
        <Pagination page={prices.page} count={prices.count} onChange={goTo} label="Trang giá từng chỗ" />
        <p className="text-xs text-muted">Gõ tắt được: 120k, 1tr2, 1.062.000. Xóa trống là chưa có giá.</p>
      </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Chi phí khác</h2>
        {info.expenses.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {info.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.label}</p>
                  <p className="text-xs text-muted tabular-nums">{vnd(perPerson(e.amount, people))}/người</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{vnd(e.amount)}</span>
                <button
                  type="button"
                  aria-label={`Xóa ${e.label}`}
                  onClick={() => removeExpense.mutate(e.id)}
                  disabled={e.id.startsWith('optimistic-')}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded text-bad pressable hover:bg-surface disabled:opacity-40"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <ExpenseForm onAdd={(v) => addExpense.mutate(v)} />
      </Card>

      {stats && <SettlePanel trip={info.trip} total={stats.total} />}

      <Link href={`/trips/${tripId}/recap`} className="pressable flex min-h-11 items-center justify-center gap-2 rounded bg-deep text-sm font-semibold text-white">
        <Sparkles size={18} aria-hidden />
        Tổng kết chuyến
      </Link>
    </div>
  );
}
