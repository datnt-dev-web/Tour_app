'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { clearPageCache } from '@/shared/pwa/clear-page-cache';
import { Button } from '@/shared/ui/button';
import { signInWithUsernameAction } from '../actions/login-actions';

/** Đăng nhập bằng username + PIN 6 số do admin cấp; không có đăng ký. */
export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Phiên hết hạn cũng đổ về /login: dọn cache trang của người dùng trước.
  useEffect(() => {
    void clearPageCache();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await signInWithUsernameAction({ username, pin });
    if (result.ok) {
      router.replace('/');
      router.refresh();
      return;
    }
    setPending(false);
    setPin('');
    setFailure(result.error.message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {failure && <p role="alert" className="rounded bg-bad-bg p-3 text-sm text-bad">{failure}</p>}
      <input
        required
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Tên đăng nhập"
        aria-label="Tên đăng nhập"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="min-h-11 rounded border border-line bg-white px-3 text-base"
      />
      <input
        required
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        pattern="d{6}"
        maxLength={6}
        placeholder="PIN 6 số"
        aria-label="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/D/g, ''))}
        className="min-h-11 rounded border border-line bg-white px-3 text-base tracking-[0.3em]"
      />
      <Button type="submit" disabled={pending || !username.trim() || pin.length !== 6}>
        Đăng nhập
      </Button>
    </form>
  );
}
