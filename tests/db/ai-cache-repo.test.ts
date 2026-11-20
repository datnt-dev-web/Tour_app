import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, test } from 'vitest';
import { createAiCacheRepo } from '@/features/ai/repositories/ai-cache-repo';
import type { Database } from '@/shared/supabase/database.types';

const admin = createClient<Database>(process.env.DB_TEST_SUPABASE_URL!, process.env.DB_TEST_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repo = createAiCacheRepo(admin);
const prefix = `test:${Date.now()}:`;

afterAll(async () => {
  await admin.from('ai_cache').delete().like('key', `${prefix}%`);
});

describe('ai-cache-repo', () => {
  test('set rồi get trả lại giá trị, set lần 2 ghi đè', async () => {
    await repo.set(`${prefix}a`, { pros: ['ngon'] }, 60);
    expect(await repo.get(`${prefix}a`)).toEqual({ pros: ['ngon'] });
    await repo.set(`${prefix}a`, { pros: ['dở'] }, 60);
    expect(await repo.get(`${prefix}a`)).toEqual({ pros: ['dở'] });
  });

  test('khóa không có hoặc đã hết hạn là miss', async () => {
    expect(await repo.get(`${prefix}none`)).toBeNull();
    await repo.set(`${prefix}old`, [1], -1);
    expect(await repo.get(`${prefix}old`)).toBeNull();
  });
});
