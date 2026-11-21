'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, QrCode, Trash2, UserPlus, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { BANKS, bankName } from '@/shared/banks';
import { formatVnd } from '@/shared/money';
import { queryKeys } from '@/shared/query/keys';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { buildVietQrPayload } from '@/shared/vietqr';
import { addParticipantAction, removeParticipantAction, setPaidAction, setPayerAction, setPayerBankAction } from '../actions/settle-actions';
import { createSettleRepo, type TripParticipant } from '../repositories/settle-repo';
import type { Trip } from '../repositories/trips-repo';
import { computeSettlement } from '../services/settle';

const FIELD = 'min-h-11 w-full rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent';

const participantsQuery = (tripId: string) =>
  queryOptions({ queryKey: queryKeys.tripParticipants(tripId), queryFn: () => createSettleRepo(createBrowserSupabase()).list(tripId) });

/** Mọi thay đổi người tham gia/thủ quỹ đều có thể đổi số người chia (trigger DB) và thông tin chuyến. */
function useSettleMutation<V>(tripId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.tripParticipants(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStats(tripId) }),
      ]),
  });
}

/** Một người trả hết, cuối chuyến chia đều: danh sách người tham gia, thủ quỹ, ai đã chuyển, mã VietQR. */
export function SettlePanel({ trip, total }: { trip: Trip; total: number }) {
  const tripId = trip.id;
  const { data: participants = [], isPending } = useQuery(participantsQuery(tripId));
  const add = useSettleMutation(tripId, async (name: string) => unwrap(await addParticipantAction({ tripId, name })));
  const remove = useSettleMutation(tripId, async (id: string) => unwrap(await removeParticipantAction({ id })));
  const setPayer = useSettleMutation(tripId, async (participantId: string) => unwrap(await setPayerAction({ tripId, participantId })));
  const setPaid = useSettleMutation(tripId, async (v: { id: string; paid: boolean }) => unwrap(await setPaidAction(v)));
  const [qrFor, setQrFor] = useState<TripParticipant | null>(null);
  const [name, setName] = useState('');

  const s = computeSettlement(
    total,
    participants.map((p) => ({ ...p, isPayer: p.is_payer })),
  );
  const hasBank = !!(trip.payer_bank_bin && trip.payer_account_no && trip.payer_account_name);
  const error = add.error ?? remove.error ?? setPayer.error ?? setPaid.error;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) add.mutate(name.trim(), { onSuccess: () => setName('') });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Chia tiền</h2>
        {s.perPerson > 0 && <span className="text-sm font-semibold tabular-nums">{formatVnd(s.perPerson)}/người</span>}
      </div>
      <p className="text-sm text-muted">Một người trả hết, cuối chuyến mọi người chuyển lại cho thủ quỹ phần của mình (làm tròn lên nghìn đồng).</p>

      {!isPending && participants.length === 0 && <p className="text-sm text-muted">Thêm tên những người đi chuyến này, rồi chọn thủ quỹ (👑).</p>}

      {participants.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {participants.map((p) => {
            const row = s.rows.find((r) => r.participant.id === p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <button
                  type="button"
                  aria-label={p.is_payer ? `${p.name} là thủ quỹ` : `Chọn ${p.name} làm thủ quỹ`}
                  aria-pressed={p.is_payer}
                  onClick={() => !p.is_payer && setPayer.mutate(p.id)}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded pressable ${p.is_payer ? 'text-accent' : 'text-line hover:bg-surface hover:text-muted'}`}
                >
                  <Crown size={18} aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted tabular-nums">{p.is_payer ? 'Thủ quỹ' : row ? `Phải chuyển ${formatVnd(row.owes)}` : ''}</p>
                </div>
                {!p.is_payer && row && row.owes > 0 && (
                  <>
                    <button
                      type="button"
                      aria-pressed={p.paid}
                      onClick={() => setPaid.mutate({ id: p.id, paid: !p.paid })}
                      className={`min-h-11 shrink-0 rounded px-3 text-xs font-semibold pressable ${p.paid ? 'bg-good-bg text-good' : 'border border-line text-muted hover:bg-surface'}`}
                    >
                      {p.paid ? 'Đã chuyển' : 'Chưa chuyển'}
                    </button>
                    {hasBank && !p.paid && (
                      <button type="button" aria-label={`Mã QR cho ${p.name}`} onClick={() => setQrFor(p)} className="inline-flex size-11 shrink-0 items-center justify-center rounded text-accent pressable hover:bg-surface">
                        <QrCode size={18} aria-hidden />
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  aria-label={`Bỏ ${p.name}`}
                  onClick={() => remove.mutate(p.id)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded text-bad pressable hover:bg-surface"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {s.rows.length > 0 && s.perPerson > 0 && (
        <p className="text-sm tabular-nums">
          Đã thu <span className="font-semibold text-good">{formatVnd(s.collected)}</span> · Còn thiếu <span className="font-semibold text-bad">{formatVnd(s.outstanding)}</span>
        </p>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Tên người tham gia" aria-label="Tên người tham gia" className={FIELD} />
        <Button type="submit" variant="secondary" disabled={!name.trim() || add.isPending} className="shrink-0 px-3">
          <UserPlus size={18} aria-hidden />
          Thêm
        </Button>
      </form>

      {s.payer && <PayerBankForm trip={trip} />}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error.message}
        </p>
      )}

      {qrFor && s.payer && hasBank && (
        <QrSheet trip={trip} payerName={s.payer.name} participant={qrFor} amount={s.perPerson} onClose={() => setQrFor(null)} />
      )}
    </Card>
  );
}

/** Tài khoản nhận tiền của thủ quỹ: lưu trên chuyến để mọi người quét mã của chính mình. */
function PayerBankForm({ trip }: { trip: Trip }) {
  const [editing, setEditing] = useState(!trip.payer_account_no);
  const [bin, setBin] = useState(trip.payer_bank_bin ?? BANKS[0].bin);
  const [accountNo, setAccountNo] = useState(trip.payer_account_no ?? '');
  const [accountName, setAccountName] = useState(trip.payer_account_name ?? '');
  const save = useSettleMutation(trip.id, async () => unwrap(await setPayerBankAction({ tripId: trip.id, bin, accountNo, accountName })));

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded bg-surface p-3 text-sm">
        <span className="min-w-0 truncate">
          Nhận tiền: <b>{bankName(trip.payer_bank_bin)}</b> · {trip.payer_account_no} · {trip.payer_account_name}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="min-h-11 shrink-0 px-2 font-semibold text-accent">
          Sửa
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: () => setEditing(false) });
      }}
      className="flex flex-col gap-2 rounded bg-surface p-3"
    >
      <p className="text-sm font-semibold">Tài khoản nhận tiền của thủ quỹ</p>
      <select value={bin} onChange={(e) => setBin(e.target.value)} aria-label="Ngân hàng" className={FIELD}>
        {BANKS.map((b) => (
          <option key={b.bin} value={b.bin}>
            {b.name}
          </option>
        ))}
      </select>
      <input value={accountNo} onChange={(e) => setAccountNo(e.target.value.replace(/\s/g, ''))} inputMode="numeric" required pattern="[0-9A-Za-z]{4,19}" placeholder="Số tài khoản" aria-label="Số tài khoản" className={FIELD} />
      <input value={accountName} onChange={(e) => setAccountName(e.target.value.toUpperCase())} required maxLength={60} placeholder="Tên chủ tài khoản (không dấu)" aria-label="Tên chủ tài khoản" className={FIELD} />
      {save.error && <p className="text-sm text-bad">{save.error.message}</p>}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Đang lưu…' : 'Lưu tài khoản'}
      </Button>
    </form>
  );
}

/** Mã VietQR cho một người: quét bằng app ngân hàng là điền sẵn số tiền và nội dung. */
function QrSheet({ trip, payerName, participant, amount, onClose }: { trip: Trip; payerName: string; participant: TripParticipant; amount: number; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const payload = buildVietQrPayload({ bin: trip.payer_bank_bin!, accountNo: trip.payer_account_no!, amount, content: `FoodTour ${participant.name}` });

  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: 'M' }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mã QR chuyển tiền cho ${payerName}`}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex w-full max-w-[480px] flex-col items-center gap-3 rounded-sm bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              {participant.name} chuyển {formatVnd(amount)}
            </h2>
            <p className="truncate text-sm text-muted">
              cho {payerName} · {bankName(trip.payer_bank_bin)} · {trip.payer_account_no}
            </p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded pressable hover:bg-surface">
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh data URL sinh tại chỗ, next/image không tối ưu được */}
        {src ? <img src={src} alt={`Mã VietQR ${formatVnd(amount)}`} className="size-64 max-w-full" /> : <div className="size-64 animate-pulse rounded bg-surface" />}
        <p className="text-center text-sm text-muted">Mở app ngân hàng, chọn quét QR: số tiền và nội dung đã điền sẵn.</p>
      </div>
    </div>
  );
}
