import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { RegisterSW } from '@/shared/pwa/register-sw';
import { Splash } from '@/shared/ui/splash';
import { THEME_INIT_SCRIPT } from '@/shared/ui/theme';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  // 10 file woff2 preload tranh băng thông với CSS; font tải sau, chữ hiện ngay bằng font hệ thống (display swap).
  preload: false,
});

export const metadata: Metadata = {
  title: 'Food Tour nhóm',
  description: 'Khám phá quán ăn, chỗ chơi, chỗ ở và lưu vào chuyến đi của nhóm bạn.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // Extension trình duyệt (vd. data-yd-*) chèn thuộc tính vào <html> trước khi React hydrate; chỉ bỏ qua lệch thuộc tính của riêng thẻ này.
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Đặt theme trước khi vẽ để không nháy nền sáng khi người dùng đã chọn Tối. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Splash />
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
