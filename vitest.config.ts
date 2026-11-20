import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // tests/db chạy riêng bằng `npm run test:db` (cần Postgres thật)
    exclude: ['node_modules', 'tests/db/**'],
  },
});
