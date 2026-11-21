'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';

type Gate = 'ask' | 'denied' | 'ok';

/**
 * Cổng trước màn login: hỏi có thuộc nhóm không. "Có" thì rèm mới mở (CSS đọc data-gate để chạy animation),
 * "Không" thì đuổi. Phần phía sau bị inert cho tới khi trả lời Có, để Tab không lọt vào form sau rèm.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>('ask');

  return (
    <main data-gate={gate} className="login-scene relative flex min-h-dvh items-center justify-center overflow-hidden bg-black text-[#f1f1f6]">
      <div inert={gate !== 'ok'} className="contents">
        {children}
      </div>

      <section
        role="dialog"
        aria-modal={gate === 'ask'}
        aria-labelledby="login-gate-title"
        inert={gate !== 'ask'}
        className="login-gate fixed inset-0 z-20 flex flex-col items-center justify-center gap-8 px-6 text-center"
      >
        <h2 id="login-gate-title" className="max-w-[20ch] bg-[linear-gradient(180deg,#fff_0%,#d9d9e2_45%,#8e8e9a_58%,#f4f4fa_100%)] bg-clip-text text-[clamp(26px,7vw,40px)] leading-tight font-extrabold tracking-tight text-transparent drop-shadow-[0_0_12px_rgb(220_220_255/0.5)]">
          Mày có thuộc nhóm Con lợn nhựa không?
        </h2>
        <div className="flex w-full max-w-xs gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => setGate('ok')}
            className="h-14 flex-1 cursor-pointer rounded-full border border-[#e8e8f2]/80 bg-white/10 text-lg font-bold text-white shadow-[0_0_24px_rgb(235_235_255/0.35)] transition-[background-color,transform] hover:bg-white/20 active:scale-95 focus-visible:outline-white"
          >
            Có
          </button>
          <button
            type="button"
            onClick={() => setGate('denied')}
            className="h-14 flex-1 cursor-pointer rounded-full border border-[#e8e8f2]/30 bg-black/40 text-lg font-bold text-[#b9b9c4] transition-[background-color,transform] hover:bg-white/10 active:scale-95 focus-visible:outline-white"
          >
            Không
          </button>
        </div>
      </section>

      {gate === 'denied' && (
        <section role="alert" className="login-deny fixed inset-0 z-30 overflow-hidden">
          <div className="login-deny-shake absolute inset-0">
            <Image src="/login/cut.jpg" alt="" fill priority sizes="100vw" className="login-deny-img object-cover object-[68%_40%]" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_60%_40%,transparent_30%,rgb(0_0_0/0.85)_100%)]" />
            <div aria-hidden className="login-deny-redflash absolute inset-0 bg-[#ff1744] mix-blend-overlay" />
            <p className="absolute inset-x-0 bottom-[14%] text-center">
              <span className="login-deny-word inline-block text-[min(42vw,260px)] leading-none font-extrabold tracking-[-0.04em] text-white">CÚT</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGate('ask')}
            className="login-deny-back absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 min-h-11 -translate-x-1/2 cursor-pointer rounded-full px-4 text-sm text-white/45 hover:text-white/80 focus-visible:outline-white"
          >
            Bấm nhầm? Chọn lại
          </button>
        </section>
      )}
    </main>
  );
}
