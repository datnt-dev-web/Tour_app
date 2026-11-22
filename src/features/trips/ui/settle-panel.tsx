'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, Landmark, QrCode, Trash2, UserPlus, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { BANKS, bankName } from '@/shared/banks';
import { formatVnd } from '@/shared/money';
import { queryKeys } from '@/shared/query/keys';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { buildVietQrPayload } from '@/shared/vietqr';
import { addParticipantAction, addTransferAction, removeParticipantAction, removeTransferAction, setParticipantBankAction } from '../actions/settle-actions';
import type { TripParticipant } from '../repositories/settle-repo';
import { computeSplit, type PairDebt } from '../services/settle';
import { tripSplitQuery } from './trip-queries';

const FIELD = 'min-h-11 w-full rounded border border-line bg-card px-3 text-sm outline-none focus:border-accent';
const ICON_BTN = 'inline-flex size-11 shrink-0 items-center justify-center rounded pressable hover:bg-surface';
const vnd = (n: number) => `${formatVnd(n)}đ`;
const hasBank = (p: TripParticipant) => !!(p.bank_bin && p.account_no && p.account_name);
const timeFmt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Mọi thay đổi ở phần chia tiền: làm mới dữ liệu chia, và thông tin chuyến/thống kê (số người chia đổi theo danh sách). */
function useSplitMutation<V>(tripId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.tripSplit(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
        qc.invalidateQueries({ queryKey: queryKeys.tripStats(tripId) }),
      ]),
  });
}

type Qr = { from: TripParticipant; to: TripParticipant; amount: number };

/**
 * Chia tiền nhiều người trả: mỗi khoản ghi ai đã trả (ở giá từng chỗ / chi phí khác), chia đều cho mọi người tới từng đồng;
 * ai được chia trả thẳng cho người đã chi (gộp và đối trừ theo từng cặp), ghi lại từng lần chuyển.
 */
export function SettlePanel({ tripId }: { tripId: string }) {
  const { data, isPending, isError } = useQuery(tripSplitQuery(tripId));
  const add = useSplitMutation(tripId, async (name: string) => unwrap(await addParticipantAction({ tripId, name })));
  const remove = useSplitMutation(tripId, async (id: string) => unwrap(await removeParticipantAction({ id })));
  const transfer = useSplitMutation(tripId, async (v: { fromId: string; toId: string; amount: number }) => unwrap(await addTransferAction({ tripId, ...v })));
  const undo = useSplitMutation(tripId, async (id: string) => unwrap(await removeTransferAction({ id })));
  const [name, setName] = useState('');
  const [bankFor, setBankFor] = useState<string | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);
  const error = add.error ?? remove.error ?? transfer.error ?? undo.error;
  const busy = transfer.isPending || undo.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) add.mutate(name.trim(), { onSuccess: () => setName('') });
  }

  if (isPending) return <Skeleton className="h-40" />;
  if (isError || !data) return <p className="text-sm text-bad">Không tải được phần chia tiền, thử lại sau.</p>;

  const { participants, transfers } = data;
  const split = computeSplit(participants, data.items, transfers);
  const byId = new Map(participants.map((p) => [p.id, p]));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Chia tiền</h2>
        <p className="text-sm text-muted">
          Ghi ai đã trả ở từng khoản (giá từng chỗ, chi phí khác). Mỗi khoản chia đều cho mọi người, chính xác tới từng đồng; ai được chia thì trả thẳng cho người đã chi.
        </p>
      </div>

      {split.unassigned.count > 0 && participants.length > 0 && (
        <p role="status" className="rounded bg-warn-bg p-3 text-sm text-warn">
          Còn {split.unassigned.count} khoản ({vnd(split.unassigned.total)}) có giá nhưng chưa ghi ai trả, chưa tính vào chia tiền.
        </p>
      )}

      {/* Người tham gia: đã trả, phần của mình, còn được nhận / phải trả. */}
      {participants.length === 0 ? (
        <p className="text-sm text-muted">Thêm tên những người đi chuyến này, rồi ghi ai trả ở từng khoản.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {split.people.map(({ person: p, paid, share, balance }) => (
            <li key={p.id} className="flex flex-col py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted tabular-nums">
                    Đã trả {vnd(paid)} · Phần {vnd(share)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${balance > 0 ? 'text-good' : balance < 0 ? 'text-bad' : 'text-muted'}`}>
                  {balance > 0 ? `+${vnd(balance)}` : balance < 0 ? `−${vnd(-balance)}` : 'Xong'}
                </span>
                <button
                  type="button"
                  aria-label={`Tài khoản nhận tiền của ${p.name}`}
                  aria-expanded={bankFor === p.id}
                  onClick={() => setBankFor((v) => (v === p.id ? null : p.id))}
                  className={`${ICON_BTN} ${hasBank(p) ? 'text-accent' : 'text-muted'}`}
                >
                  <Landmark size={18} aria-hidden />
                </button>
                <button type="button" aria-label={`Bỏ ${p.name}`} onClick={() => remove.mutate(p.id)} className={`${ICON_BTN} text-bad`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              {bankFor === p.id && <BankForm tripId={tripId} participant={p} onDone={() => setBankFor(null)} />}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Tên người tham gia" aria-label="Tên người tham gia" className={FIELD} />
        <Button type="submit" variant="secondary" disabled={!name.trim() || add.isPending} className="shrink-0 px-3">
          <UserPlus size={18} aria-hidden />
          Thêm
        </Button>
      </form>

      {/* Ai trả cho ai. */}
      {split.pairs.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Ai trả cho ai">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">Ai trả cho ai</h3>
            {split.settled && <span className="text-xs font-semibold text-good">Đã xong hết</span>}
          </div>
          <ul className="flex flex-col gap-2">
            {split.pairs.map((d) => (
              <PairRow
                key={`${d.from.id}-${d.to.id}`}
                debt={d}
                busy={busy}
                onTransfer={(fromId, toId, amount) => transfer.mutate({ fromId, toId, amount })}
                onQr={setQr}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Lịch sử chuyển: xóa được nếu ghi nhầm. */}
      {transfers.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="Các lần đã chuyển">
          <h3 className="text-sm font-bold">Đã ghi chuyển</h3>
          <ul className="flex flex-col divide-y divide-line">
            {[...transfers].reverse().map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {byId.get(t.fromId)?.name} <ArrowRight size={12} aria-label="chuyển cho" className="inline" /> {byId.get(t.toId)?.name}
                  <span className="ml-1 text-xs text-muted">{timeFmt.format(new Date(t.createdAt))}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{vnd(t.amount)}</span>
                {confirmUndo === t.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => undo.mutate(t.id, { onSettled: () => setConfirmUndo(null) })}
                    className="min-h-11 shrink-0 rounded bg-bad px-3 text-xs font-semibold text-white pressable"
                  >
                    Xóa lần này?
                  </button>
                ) : (
                  <button type="button" aria-label="Xóa lần chuyển ghi nhầm" onClick={() => setConfirmUndo(t.id)} className={`${ICON_BTN} text-muted`}>
                    <X size={16} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error.message}
        </p>
      )}

      {qr && <QrSheet {...qr} onClose={() => setQr(null)} />}
    </Card>
  );
}

/** Một cặp người: còn thiếu bao nhiêu, chi tiết từng khoản tạo ra số đó, nút ghi đã chuyển / mã QR. */
function PairRow({
  debt: d,
  busy,
  onTransfer,
  onQr,
}: {
  debt: PairDebt<TripParticipant>;
  busy: boolean;
  onTransfer: (fromId: string, toId: string, amount: number) => void;
  onQr: (qr: Qr) => void;
}) {
  const [open, setOpen] = useState(false);
  // Chuyển dư thì người nhận trả lại phần dư: đảo chiều người trả.
  const back = d.remaining < 0;
  const [payer, receiver, amount] = back ? [d.to, d.from, -d.remaining] : [d.from, d.to, d.remaining];

  return (
    <li className="rounded border border-line p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <b>{payer.name}</b> <ArrowRight size={14} aria-label={back ? 'trả lại cho' : 'chuyển cho'} className="inline text-muted" /> <b>{receiver.name}</b>
          {back && <span className="block text-xs text-muted">Trả lại phần đã chuyển dư</span>}
        </p>
        {amount > 0 ? (
          <span className="shrink-0 text-base font-bold tabular-nums">{vnd(amount)}</span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-good">
            <Check size={16} aria-hidden />
            Xong
          </span>
        )}
      </div>

      {amount > 0 && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onTransfer(payer.id, receiver.id, amount)}
            className="min-h-11 flex-1 rounded bg-accent px-3 text-sm font-semibold text-white pressable hover:bg-accent-strong disabled:opacity-60"
          >
            {back ? 'Đã trả lại' : 'Đã chuyển đủ'} {vnd(amount)}
          </button>
          {hasBank(receiver) && (
            <button
              type="button"
              aria-label={`Mã QR ${payer.name} chuyển ${receiver.name}`}
              onClick={() => onQr({ from: payer, to: receiver, amount })}
              className={`${ICON_BTN} border border-line text-accent`}
            >
              <QrCode size={18} aria-hidden />
            </button>
          )}
        </div>
      )}

      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-muted">
        <ChevronDown size={14} aria-hidden className={open ? 'rotate-180' : ''} />
        Chi tiết
      </button>
      {open && (
        <ul className="flex flex-col gap-1 text-xs tabular-nums">
          {d.items.map((l) => (
            <li key={`${l.itemId}-${l.direction}`} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                {l.direction === 'owe' ? `${d.to.name} trả ${l.label}` : `${d.from.name} trả ${l.label}`}
              </span>
              <span className={l.direction === 'owe' ? '' : 'text-good'}>
                {l.direction === 'owe' ? '+' : '−'}
                {vnd(l.amount)}
              </span>
            </li>
          ))}
          {d.transferred !== 0 && (
            <li className="flex justify-between gap-2">
              <span>Đã chuyển</span>
              <span className="text-good">−{vnd(d.transferred)}</span>
            </li>
          )}
          <li className="flex justify-between gap-2 border-t border-line pt-1 font-semibold">
            <span>{back ? `${d.to.name} trả lại ${d.from.name}` : `${d.from.name} còn nợ ${d.to.name}`}</span>
            <span>{vnd(amount)}</span>
          </li>
        </ul>
      )}
    </li>
  );
}

/** Tài khoản nhận tiền của một người: lưu theo người để ai nợ họ cũng quét được mã. */
function BankForm({ tripId, participant: p, onDone }: { tripId: string; participant: TripParticipant; onDone: () => void }) {
  const [bin, setBin] = useState(p.bank_bin ?? BANKS[0].bin);
  const [accountNo, setAccountNo] = useState(p.account_no ?? '');
  const [accountName, setAccountName] = useState(p.account_name ?? '');
  const save = useSplitMutation(tripId, async (bank: { bin: string; accountNo: string; accountName: string } | null) =>
    unwrap(await setParticipantBankAction({ participantId: p.id, bank })),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ bin, accountNo, accountName }, { onSuccess: onDone });
      }}
      className="mt-2 flex flex-col gap-2 rounded bg-surface p-3"
    >
      <p className="text-sm font-semibold">Tài khoản nhận tiền của {p.name}</p>
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
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending} className="flex-1">
          {save.isPending ? 'Đang lưu…' : 'Lưu tài khoản'}
        </Button>
        {hasBank(p) && (
          <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(null, { onSuccess: onDone })}>
            Bỏ tài khoản
          </Button>
        )}
      </div>
    </form>
  );
}

/** Mã VietQR: quét bằng app ngân hàng là điền sẵn tài khoản người nhận, số tiền và nội dung. */
function QrSheet({ from, to, amount, onClose }: Qr & { onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const payload = buildVietQrPayload({ bin: to.bank_bin!, accountNo: to.account_no!, amount, content: `FoodTour ${from.name}` });

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
        aria-label={`Mã QR chuyển tiền cho ${to.name}`}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up flex w-full max-w-[480px] flex-col items-center gap-3 rounded-sm bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              {from.name} chuyển {vnd(amount)}
            </h2>
            <p className="truncate text-sm text-muted">
              cho {to.account_name} · {bankName(to.bank_bin)} · {to.account_no}
            </p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className={ICON_BTN}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh data URL sinh tại chỗ, next/image không tối ưu được */}
        {src ? <img src={src} alt={`Mã VietQR ${vnd(amount)}`} className="size-64 max-w-full" /> : <div className="size-64 animate-pulse rounded bg-surface" />}
        <p className="text-center text-sm text-muted">Mở app ngân hàng, chọn quét QR: số tiền và nội dung đã điền sẵn. Chuyển xong nhớ bấm “Đã chuyển đủ”.</p>
      </div>
    </div>
  );
}
