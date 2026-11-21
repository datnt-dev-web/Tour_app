'use client';

import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { Button } from '@/shared/ui/button';
import { changePinAction } from '../actions/login-actions';

const PIN_FIELD = 'min-h-11 w-full rounded border border-line bg-white px-3 text-base tracking-[0.3em]';
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Nút "Đổi PIN" mở form nhỏ ngay dưới đầu trang: PIN hiện tại + PIN mới (nhập 2 lần). */
export function ChangePinButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [state, setState] = useState<{ pending: boolean; error: string | null; done: boolean }>({ pending: false, error: null, done: false });
  const mismatch = again.length === 6 && again !== next;

  function close() {
    setOpen(false);
    setCurrent('');
    setNext('');
    setAgain('');
    setState({ pending: false, error: null, done: false });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setState({ pending: true, error: null, done: false });
    try {
      unwrap(await changePinAction({ current, next }));
      setState({ pending: false, error: null, done: true });
    } catch (err) {
      setState({ pending: false, error: (err as Error).message, done: false });
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="px-3">
        <KeyRound size={18} aria-hidden />
        Đổi PIN
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in" onClick={close}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Đổi PIN"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="animate-sheet-up flex w-full max-w-[480px] flex-col gap-3 rounded-sm bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <h2 className="text-base font-bold">Đổi PIN</h2>
        {state.done ? (
          <>
            <p role="status" className="rounded bg-good-bg p-2 text-sm text-good">
              Đã đổi PIN. Lần sau đăng nhập bằng PIN mới.
            </p>
            <Button onClick={close}>Xong</Button>
          </>
        ) : (
          <>
            <input type="password" inputMode="numeric" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(digits(e.target.value))} placeholder="PIN hiện tại" aria-label="PIN hiện tại" className={PIN_FIELD} />
            <input type="password" inputMode="numeric" autoComplete="new-password" required value={next} onChange={(e) => setNext(digits(e.target.value))} placeholder="PIN mới (6 số)" aria-label="PIN mới" className={PIN_FIELD} />
            <input type="password" inputMode="numeric" autoComplete="new-password" required value={again} onChange={(e) => setAgain(digits(e.target.value))} placeholder="Nhập lại PIN mới" aria-label="Nhập lại PIN mới" className={PIN_FIELD} />
            {mismatch && <p className="text-sm text-bad">Hai lần nhập PIN mới không khớp.</p>}
            {state.error && (
              <p role="alert" className="text-sm text-bad">
                {state.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close} className="flex-1">
                Hủy
              </Button>
              <Button type="submit" disabled={state.pending || current.length !== 6 || next.length !== 6 || again !== next} className="flex-1">
                {state.pending ? 'Đang đổi…' : 'Đổi PIN'}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
