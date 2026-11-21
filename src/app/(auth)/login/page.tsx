import Image from 'next/image';
import type { CSSProperties } from 'react';
import { LoginForm } from '@/features/auth/ui/login-form';
import { LoginGate } from '@/features/auth/ui/login-gate';

// Vị trí theo % của ảnh khung (tỷ lệ 1:2): ánh lóe trên các mũi gai, bụi sáng trên vòng phép dưới chân.
const GLINTS = [
  { left: '49.6%', top: '5.2%', delay: '2.6s' },
  { left: '9%', top: '23%', delay: '3.4s' },
  { left: '90%', top: '22%', delay: '4.6s' },
  { left: '4.5%', top: '70%', delay: '6s' },
  { left: '95%', top: '71%', delay: '3.9s' },
  { left: '49.8%', top: '87%', delay: '4.9s' },
];
const DUST = [
  { left: '30%', top: '92%', duration: '6s', delay: '2.5s' },
  { left: '58%', top: '95%', duration: '7s', delay: '3.6s' },
  { left: '70%', top: '90%', duration: '5.5s', delay: '4.4s' },
];
const STAR_PATH = 'M12 0 L13.2 10.8 L24 12 L13.2 13.2 L12 24 L10.8 13.2 L0 12 L10.8 10.8 Z';
const CURTAIN_FOLDS =
  'repeating-linear-gradient(90deg, #040405 0px, #17171c 16px, #3a3a44 24px, #121216 36px, #050506 50px), linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(0 0 0 / 0.6))';

export default function LoginPage() {
  return (
    <LoginGate>
      {/* Sân khấu giữ tỷ lệ ảnh 1:2; chữ co theo bề rộng sân khấu (cqw). svh để bàn phím ảo không làm sân khấu co lại. */}
      <div className="relative aspect-[1/2] w-[min(100vw,480px,50svh)] [container-type:inline-size]">
        <div className="login-stage absolute inset-0">
          <Image src="/login/frame.webp" alt="" fill priority sizes="(max-width: 480px) 100vw, 480px" className="pointer-events-none select-none" />
          <Image
            src="/login/emblem.webp"
            alt=""
            width={360}
            height={360}
            // Emblem chiếm 26% bề rộng sân khấu (tối đa 480px): không có sizes thì Next tải bản 750px.
            sizes="(max-width: 480px) 26vw, 125px"
            priority
            className="pointer-events-none absolute top-[10.4%] left-[37%] w-[26%] select-none drop-shadow-[0_0_18px_rgb(225_29_72/0.45)]"
          />
          <div aria-hidden>
            {GLINTS.map((g) => (
              <svg
                key={`${g.left}-${g.top}`}
                viewBox="0 0 24 24"
                className="login-glint absolute -mt-[3.3cqw] -ml-[3.3cqw] w-[6.6cqw]"
                style={{ left: g.left, top: g.top, animationDelay: g.delay }}
              >
                <path d={STAR_PATH} fill="#fff" />
              </svg>
            ))}
            {['2.4s', '4.9s'].map((delay) => (
              <span key={delay} className="login-ripple absolute top-[90%] left-[20%] aspect-square w-[60%]" style={{ animationDelay: delay }} />
            ))}
            {DUST.map((d) => (
              <span
                key={d.left}
                className="login-dust absolute size-[2px]"
                style={{ left: d.left, top: d.top, animationDuration: d.duration, animationDelay: d.delay }}
              />
            ))}
          </div>
        </div>

        <header className="login-rise absolute top-[31.6%] left-[10%] flex w-[80%] flex-col items-center gap-[1cqw] text-center">
          <h1 className="bg-[linear-gradient(180deg,#fff_0%,#d9d9e2_45%,#8e8e9a_58%,#f4f4fa_100%)] bg-clip-text text-[8.6cqw] leading-tight font-bold tracking-tight text-transparent drop-shadow-[0_0_10px_rgb(220_220_255/0.55)]">
            Food Tour nhóm
          </h1>
          <p className="text-[3.1cqw] leading-snug whitespace-nowrap text-[#e9e9ef] [text-shadow:0_0_8px_rgb(255_255_255/0.35)]">
            Cùng nhóm bạn chọn quán ăn cho mỗi chuyến đi.
          </p>
        </header>

        <div className="login-rise absolute inset-0" style={{ '--rise-step': '0.25s' } as CSSProperties}>
          <LoginForm />
        </div>
      </div>

      {/* Rèm nhung đen hai cánh phủ cả màn hình, kéo sang hai bên lúc vào trang. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-10">
        <div
          className="login-curtain-l absolute inset-y-0 left-0 w-[51%] shadow-[8px_0_24px_rgb(0_0_0/0.8),inset_-2px_0_0_rgb(230_230_245/0.35)]"
          style={{ backgroundImage: CURTAIN_FOLDS, backgroundBlendMode: 'normal, overlay' }}
        />
        <div
          className="login-curtain-r absolute inset-y-0 right-0 w-[51%] shadow-[-8px_0_24px_rgb(0_0_0/0.8),inset_2px_0_0_rgb(230_230_245/0.35)]"
          style={{ backgroundImage: CURTAIN_FOLDS, backgroundBlendMode: 'normal, overlay' }}
        />
        <div className="login-seam absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-[linear-gradient(180deg,transparent,#fff_50%,transparent)] shadow-[0_0_18px_4px_rgb(230_230_255/0.6)]" />
      </div>
    </LoginGate>
  );
}
