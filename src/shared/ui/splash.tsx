import Image from 'next/image';

/**
 * Màn chờ ~1 giây mỗi lần mở web (tải trang đầy đủ). Có sẵn trong HTML từ server và tự ẩn bằng CSS
 * (`.splash`), không cần JS, nên không nháy nội dung trước khi hiện. Điều hướng trong app không hiện lại.
 */
export function Splash() {
  return (
    <div aria-hidden className="splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-surface">
      <Image src="/gifs/loading.gif" alt="" width={112} height={112} unoptimized priority />
      <p className="text-sm font-semibold text-muted">Food Tour nhóm</p>
    </div>
  );
}
