'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { clearPageCache } from '@/shared/pwa/clear-page-cache';
import { signInWithUsernameAction } from '../actions/login-actions';

/** Chỉ đăng nhập bằng username do admin cấp; không có đăng ký. */
export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
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
    const result = await signInWithUsernameAction({ username });
    if (result.ok) {
      router.replace('/');
      router.refresh();
      return;
    }
    setPending(false);
    setFailure(result.error.message);
  }

  const disabled = pending || !username.trim();

  // Đặt tuyệt đối trên ảnh khung của màn login (tỷ lệ 1:2): ô gõ nằm sau vạch ngăn của viên nhập vẽ sẵn, nút phủ đúng viên nút.
  return (
    <form onSubmit={submit}>
      {failure && (
        <p role="alert" className="absolute bottom-[52.2%] left-[12%] w-[76%] rounded-2xl bg-black/75 px-[3cqw] py-[1cqw] text-center text-[3.2cqw] leading-snug text-[#fda4af]">
          {failure}
        </p>
      )}
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
        // Chữ tối thiểu 16px để iOS không tự phóng to khi bấm vào ô.
        className="absolute top-[48.5%] left-[29.5%] h-[4.4%] w-[56%] border-0 bg-transparent p-0 text-[max(16px,4.4cqw)] text-[#f6f6fb] caret-white placeholder:text-[#9b9ba4] focus:[text-shadow:0_0_10px_rgb(255_255_255/0.45)]"
      />
      <button
        type="submit"
        disabled={disabled}
        className="group absolute top-[59.8%] left-[19.7%] h-[5.8%] w-[60.6%] cursor-pointer rounded-full bg-transparent text-[5cqw] font-semibold tracking-wide text-[#f6f6fb] transition-transform [text-shadow:0_0_10px_rgb(255_255_255/0.55)] focus-visible:outline-[#f4f4fa] active:scale-[0.985] disabled:cursor-default"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(60%_90%_at_50%_50%,rgb(255_255_255/0.16),transparent)] opacity-0 shadow-[0_0_26px_rgb(235_235_255/0.3)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0"
        />
        <span className="relative group-disabled:opacity-60">{pending ? 'Đang vào…' : 'Đăng nhập'}</span>
      </button>
    </form>
  );
}
