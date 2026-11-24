'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { formatVnd, parseMoney, perPerson } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FIELD } from '@/shared/ui/field';
import { IconButton } from '@/shared/ui/icon-button';
import type { TripParticipant } from '../repositories/settle-repo';
import type { TripExpense } from '../repositories/trips-repo';
import { MoneyInput } from './money-input';
import { PayerSelect } from './payer-select';
import { useAddExpense, useRemoveExpense, useUpdateExpense } from './use-trip-mutations';

const vnd = (n: number) => `${formatVnd(n)}đ`;
const LABEL_MAX = 120;
/** Ô trông như chữ thường, bấm vào mới hiện viền để sửa. */
const INLINE = 'min-h-9 rounded-sm border border-transparent bg-transparent px-1 hover:border-line focus:border-accent focus:bg-card focus:outline-none';
const isOptimistic = (e: TripExpense) => e.id.startsWith('optimistic-');

/** Tên khoản chi sửa tại chỗ: Enter hoặc rời ô là lưu, Esc là bỏ; để trống thì giữ tên cũ. */
function LabelInput({ value, onCommit, disabled }: { value: string; onCommit: (label: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const label = draft.trim();
    if (label && label !== value) onCommit(label);
    setDraft(null);
  }

  return (
    <input
      aria-label={`Tên khoản chi ${value}`}
      maxLength={LABEL_MAX}
      disabled={disabled}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(null);
        }
      }}
      className={`${INLINE} -ml-1 w-full truncate text-sm font-semibold`}
    />
  );
}

function ExpenseForm({ participants, onAdd }: { participants: TripParticipant[]; onAdd: (v: { label: string; amount: number; paidBy: string | null }) => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  // Người đã chọn bị xóa khỏi danh sách thì coi như chưa chọn.
  const payer = paidBy && participants.some((p) => p.id === paidBy) ? paidBy : null;
  const parsed = parseMoney(amount);
  const valid = label.trim() !== '' && typeof parsed === 'number';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({ label, amount: parsed, paidBy: payer });
    setLabel('');
    setAmount('');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Khoản chi"
          maxLength={LABEL_MAX}
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
      {participants.length > 0 && <PayerSelect label="Ai trả khoản chi mới" value={payer} participants={participants} onChange={setPaidBy} />}
      <Button type="submit" variant="secondary" disabled={!valid}>
        <Plus size={16} aria-hidden />
        Thêm khoản chi
      </Button>
    </form>
  );
}

/**
 * Chi phí không gắn với chỗ nào (vé tàu, phòng...). Chỉ admin nhóm thêm/sửa/xóa được (database cũng chặn):
 * bấm vào tên hoặc số tiền để sửa, xóa phải bấm xác nhận. Thành viên khác chỉ xem.
 */
export function ExpensesCard({
  tripId,
  expenses,
  people,
  participants,
  canEdit,
}: {
  tripId: string;
  expenses: TripExpense[];
  people: number;
  participants: TripParticipant[];
  canEdit: boolean;
}) {
  const addExpense = useAddExpense(tripId);
  const removeExpense = useRemoveExpense(tripId);
  const updateExpense = useUpdateExpense(tripId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const error = addExpense.error ?? removeExpense.error ?? updateExpense.error;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Chi phí khác</h2>
      {expenses.length === 0 && !canEdit && <p className="text-sm text-muted">Chưa có chi phí khác.</p>}
      {expenses.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {expenses.map((e) => {
            const pending = isOptimistic(e);
            return (
              <li key={e.id} className="flex flex-col gap-2 py-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {canEdit ? (
                      <LabelInput value={e.label} disabled={pending} onCommit={(label) => updateExpense.mutate({ expenseId: e.id, patch: { label } })} />
                    ) : (
                      <p className="truncate text-sm font-semibold">{e.label}</p>
                    )}
                    <p className="text-xs text-muted tabular-nums">{vnd(perPerson(e.amount, people))}/người</p>
                    {participants.length > 0 && (
                      <PayerSelect
                        label={`Ai trả ${e.label}`}
                        value={e.paid_by}
                        participants={participants}
                        disabled={pending}
                        readOnly={!canEdit}
                        onChange={(paidBy) => updateExpense.mutate({ expenseId: e.id, patch: { paidBy } })}
                      />
                    )}
                  </div>
                  {canEdit ? (
                    <MoneyInput
                      aria-label={`Số tiền ${e.label}`}
                      disabled={pending}
                      value={e.amount}
                      // Khoản chi luôn phải có số tiền: xóa trống thì giữ số cũ.
                      onCommit={(amount) => amount !== null && updateExpense.mutate({ expenseId: e.id, patch: { amount } })}
                      className={`${INLINE} w-32 shrink-0 text-right text-sm font-semibold`}
                    />
                  ) : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{vnd(e.amount)}</span>
                  )}
                  {canEdit && confirmId !== e.id && (
                    <IconButton label={`Xóa ${e.label}`} tone="danger" onClick={() => setConfirmId(e.id)} disabled={pending}>
                      <Trash2 size={18} aria-hidden />
                    </IconButton>
                  )}
                </div>
                {canEdit && confirmId === e.id && (
                  <div role="group" aria-label={`Xác nhận xóa ${e.label}`} className="flex items-center gap-2 rounded bg-bad-bg p-2">
                    <p className="min-w-0 flex-1 text-sm">
                      Xóa <b>{e.label}</b> ({vnd(e.amount)})? Số tiền chia sẽ tính lại.
                    </p>
                    <IconButton label="Không xóa" tone="muted" onClick={() => setConfirmId(null)}>
                      <X size={16} aria-hidden />
                    </IconButton>
                    <button
                      type="button"
                      disabled={removeExpense.isPending}
                      onClick={() => removeExpense.mutate(e.id, { onSettled: () => setConfirmId(null) })}
                      className="min-h-11 shrink-0 rounded bg-bad px-3 text-xs font-semibold text-white pressable"
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error.message}
        </p>
      )}
      {canEdit ? (
        <>
          <ExpenseForm participants={participants} onAdd={(v) => addExpense.mutate(v)} />
          <p className="text-xs text-muted">Bấm vào tên hoặc số tiền để sửa.</p>
        </>
      ) : (
        <p className="text-xs text-muted">Chỉ admin nhóm thêm, sửa, xóa được chi phí.</p>
      )}
    </Card>
  );
}
