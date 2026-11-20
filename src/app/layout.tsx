import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { RegisterSW } from '@/shared/pwa/register-sw';
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
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
