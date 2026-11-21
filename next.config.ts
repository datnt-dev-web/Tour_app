import type { NextConfig } from "next";

/** Ảnh/icon trong public/ không có hash trong tên: cache 7 ngày, hết hạn vẫn dùng bản cũ trong lúc tải bản mới. */
const PUBLIC_ASSET_CACHE = 'public, max-age=604800, stale-while-revalidate=86400';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // File nhập danh sách chỗ tối đa 1 MB (IMPORT_MAX_BYTES) + phần đầu multipart: mặc định 1 MB của Next không đủ.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
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
