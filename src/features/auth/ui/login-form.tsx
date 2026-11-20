'use client';

import { useState, type FormEvent } from 'react';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { Button } from '@/shared/ui/button';

const ERRORS: Record<string, string> = { 'not-invited': 'Bạn cần link mời từ nhóm để vào.' };

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(error ? (ERRORS[error] ?? null) : null);
  const [pending, setPending] = useState(false);
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function google() {
    setFailure(null);
    const { error } = await createBrowserSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) setFailure('Không đăng nhập được, thử lại sau.');
  }

  async function magicLink(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFailure(null);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setPending(false);
    if (error) setFailure('Không gửi được email, thử lại sau.');
    else setSent(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {failure && <p role="alert" className="rounded bg-bad-bg p-3 text-sm text-bad">{failure}</p>}
      <Button onClick={google}>Đăng nhập với Google</Button>
      <p className="text-center text-xs text-muted">hoặc</p>
      {sent ? (
        <p role="status" className="rounded bg-good-bg p-3 text-sm text-good">Kiểm tra email để đăng nhập.</p>
      ) : (
        <form onSubmit={magicLink} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email của bạn"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded border border-line px-3 text-base"
          />
          <Button type="submit" variant="secondary" disabled={pending}>Gửi link đăng nhập</Button>
        </form>
      )}
    </div>
  );
}
