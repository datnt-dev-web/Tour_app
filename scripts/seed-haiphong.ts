/**
 * Seed chuyến Hải Phòng: `npm run seed:haiphong -- --group <groupId> --user <userId>`.
 * Chạy ngoài phiên người dùng nên tạo client admin trực tiếp từ process.env (không qua `env` đầy đủ,
 * vốn bắt buộc cả khóa Gemini). Script chạy với `tsx --conditions=react-server` để import
 * `server-only` (qua google-places client) không throw. Thiếu GOOGLE_PLACES_API_KEY thì seed hết ở dạng chưa xác minh.
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import data from './data/haiphong-2026-11.json';
import { createGooglePlacesClient } from '@/integrations/google-places/client';
import { createSeedDeps, seedTrip, type SeedTrip } from '@/features/places/services/seed-service';
import type { Database } from '@/shared/supabase/database.types';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);

const { values } = parseArgs({ options: { group: { type: 'string' }, user: { type: 'string' } } });
if (!values.group || !values.user) {
  console.error('Dùng: npm run seed:haiphong -- --group <groupId> --user <userId>');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) console.warn('Cảnh báo: thiếu GOOGLE_PLACES_API_KEY, mọi chỗ sẽ được seed ở dạng chưa xác minh.');

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { group: groupId, user: userId } = values;
async function main() {
  const result = await seedTrip(createSeedDeps(db, apiKey ? createGooglePlacesClient(apiKey) : null), {
    groupId,
    userId,
    data: data as SeedTrip,
  });
  console.log(`Xong: ${result.created} chỗ mới, ${result.verified} đã xác minh, ${result.unverified} chưa xác minh.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
