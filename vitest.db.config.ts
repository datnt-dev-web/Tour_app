import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Cấu hình riêng cho test chạm Postgres thật (`npm run test:db`, cần `npx supabase start`).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    setupFiles: ['tests/db/setup.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
