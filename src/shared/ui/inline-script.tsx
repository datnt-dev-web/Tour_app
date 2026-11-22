/**
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
