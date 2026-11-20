import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Food Tour nhóm',
    short_name: 'Food Tour',
    description: 'Khám phá quán ăn, chỗ chơi, chỗ ở và lưu vào chuyến đi của nhóm bạn.',
    start_url: '/',
    display: 'standalone',
    lang: 'vi',
    theme_color: '#FFFFFF',
    background_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
