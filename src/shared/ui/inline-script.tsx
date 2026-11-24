'use client';

/**
 * Phải là client component: nếu để server component thì `typeof window` luôn là undefined (kể cả trong payload RSC
 * gửi cho client), nên khi client dựng lại thẻ (vd. sau lỗi hydrate) nó vẫn là text/javascript và React cảnh báo.
 *
 * Script chạy đồng bộ lúc trình duyệt đọc HTML (trước lần vẽ đầu), theo hướng dẫn "Preventing Flash" của Next.
 * Server xuất type JavaScript để script chạy; client render type text/plain để React không cảnh báo thẻ <script>
 * (script do React tạo phía client vốn không chạy); suppressHydrationWarning bỏ qua lệch thuộc tính type.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
