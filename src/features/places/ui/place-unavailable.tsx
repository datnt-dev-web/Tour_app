import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/** Chỗ chưa lưu mà Google Places lỗi: không có tên/thành phố để dựng link kiểm tra, chỉ báo lỗi và đường quay lại. */
export function PlaceUnavailable() {
  return (
    <main className="animate-enter flex flex-col gap-4 p-4">
      <Link href="/explore" aria-label="Quay lại Khám phá" className="-ml-2 inline-flex size-11 items-center justify-center pressable rounded text-ink hover:bg-surface">
        <ArrowLeft size={20} aria-hidden />
      </Link>
      <p role="alert" className="py-8 text-center text-sm text-bad">
        Không tải được thông tin từ Google Maps, thử lại sau.
      </p>
    </main>
  );
}
