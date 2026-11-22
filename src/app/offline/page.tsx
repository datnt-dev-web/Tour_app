import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { AppFrame } from '@/shared/ui/app-frame';
import { buttonClass } from '@/shared/ui/button';

export const dynamic = 'force-static';

/** Trang tĩnh, service worker lưu sẵn: mở trang chưa từng xem lúc mất mạng thì hiện trang này. */
export default function OfflinePage() {
  return (
    <AppFrame>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff size={40} className="text-muted" aria-hidden />
        <h1 className="text-xl font-extrabold">Đang offline</h1>
        <p className="text-sm text-muted">Trang này chưa được lưu trên máy. Các chuyến, lịch trình và thông tin bạn đã mở trước đó vẫn xem được.</p>
        <Link href="/" className={buttonClass('primary', 'mt-2')}>
          Về trang Chuyến đi
        </Link>
      </main>
    </AppFrame>
  );
}
