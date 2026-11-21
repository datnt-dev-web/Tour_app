import type { NextConfig } from "next";

/** Ảnh/icon trong public/ không có hash trong tên: cache 7 ngày, hết hạn vẫn dùng bản cũ trong lúc tải bản mới. */
const PUBLIC_ASSET_CACHE = 'public, max-age=604800, stale-while-revalidate=86400';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Mặc định Next trả max-age=0 cho file trong public/, trình duyệt phải hỏi lại mỗi lần mở trang.
  async headers() {
    return ['/gifs/:path*', '/icons/:path*'].map((source) => ({ source, headers: [{ key: 'Cache-Control', value: PUBLIC_ASSET_CACHE }] }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
